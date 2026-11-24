// ═══════════════════════════════════════════════════════════════════════════
//  backend/http-functions.js  —  PARTNER PORTAL SECURE BACKEND (+ virtual office)
// ═══════════════════════════════════════════════════════════════════════════
//
//  Nov 13 2026 rebuild (security review): every Partner Portal endpoint now
//  needs a signed-in installer.
//    • The portal signs in through backend/partnerPortal.web.js (password
//      checked HERE on the server, never in the browser). It gets a session
//      token and sends it as   Authorization: Bearer <token>   on every call.
//    • WHO the installer is comes from the token, never from the request:
//      an installer can only read and change their own record, their own
//      projects (INSTALLER(S) or ADDITIONAL INSTALLER(S)), their own
//      closeouts and uploads.
//    • Answers never contain the password hash, banking numbers (shown masked
//      as ••••1234), AGC prices, profit, client details or internal notes.
//      Masked banking values sent back are ignored, so a save never
//      overwrites the real numbers with the mask.
//    • CORS only answers the AGC site and the portal's own address.
//    • The portal password can only be created or checked by
//      partnerPortal.web.js; these endpoints refuse to touch it.
//
//  Wix Secrets: AIRTABLE_TOKEN (records read/write + schema read on the AGC
//  base), IMGBB_KEY, TEAMSPACE + teamspacesecret (LiveKit).
//  After editing: Save → Publish (the /_functions/ endpoints update on publish;
//  /_functions-dev/ runs the saved-but-unpublished code).
// ═══════════════════════════════════════════════════════════════════════════

import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { ok, created, badRequest, notFound, serverError, response } from 'wix-http-functions';
import { AccessToken } from 'livekit-server-sdk';
import { OFFICE_HTML } from 'backend/officeHtml';
import { sessionInstaller, installerProjectIds } from 'backend/partnerSession';
import { rulesForPortal, writeLog, aiEnabledFor } from 'backend/fieldOpsAlfred';   // FIELD OPS ALFRED steps 2 + 3 (Nov 23 2026)

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE = 'app7LeveIY3JoIqBp';
const INSTALLERS_TABLE = 'tblMBJZ7INhXhjDAC';
const PROJECTS_TABLE = 'tblziZ2NmNH2m3HfJ';
const CLOSEOUTS_TABLE = 'tblHPffa25hrjdf03';
const STORES_TABLE = 'tblmO5352IqyYu7Pd';

const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_CONTENT = 'https://content.airtable.com/v0';
const IMGBB_UPLOAD = 'https://api.imgbb.com/1/upload';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const LIVEKIT_ROOM = 'agc-virtual-office';
const LIVEKIT_TOKEN_TTL = 60 * 60 * 6;

// ─── CORS ────────────────────────────────────────────────────────────────────
// Only the AGC site and the Partner Portal's own address get an answer the
// browser will accept. (The portal's pages run inside the GitHub Pages
// document, so their origin is the GitHub Pages address.)
const ALLOWED_ORIGINS = [
  'https://christo2345.github.io',
  'https://www.americangraphiccontractors.com',
  'https://americangraphiccontractors.com'
];
function corsFor(request) {
  const h = (request && request.headers) || {};
  const origin = String(h.origin || h.Origin || '');
  const allow = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[1];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}
// The virtual office (same origin) keeps its original open CORS.
const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function preflight(request) { return response({ status: 204, headers: corsFor(request) }); }
function okJson(body, request) { return ok({ headers: request ? corsFor(request) : OPEN_CORS, body }); }
function createdJson(body, request) { return created({ headers: request ? corsFor(request) : OPEN_CORS, body }); }
function badRequestJson(msg, request) { return badRequest({ headers: request ? corsFor(request) : OPEN_CORS, body: { error: msg } }); }
function notFoundJson(msg, request) { return notFound({ headers: request ? corsFor(request) : OPEN_CORS, body: { error: msg || 'not found' } }); }
function serverErrorJson(msg, request) { return serverError({ headers: request ? corsFor(request) : OPEN_CORS, body: { error: msg || 'server error' } }); }
function authJson(request) { return response({ status: 401, headers: corsFor(request), body: { error: 'Please sign in again.', auth: true } }); }
function forbiddenJson(request) { return response({ status: 403, headers: corsFor(request), body: { error: 'This is not one of your projects.' } }); }

// ─── INPUT VALIDATION HELPERS ────────────────────────────────────────────────
const RECORD_ID_RE = /^rec[A-Za-z0-9]{14,17}$/;
const LK_IDENTITY_RE = /^[A-Za-z0-9_-]{1,64}$/;
function isRecordId(s) { return typeof s === 'string' && RECORD_ID_RE.test(s); }
function isLkIdentity(s) { return typeof s === 'string' && LK_IDENTITY_RE.test(s); }
function isStr(v, max) { return typeof v === 'string' && v.length <= (max || 5000); }

function pickFields(fields, whitelist) {
  if (!fields || typeof fields !== 'object') return {};
  const out = {};
  for (const key of whitelist) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) out[key] = fields[key];
  }
  return out;
}

// ─── SESSION ─────────────────────────────────────────────────────────────────
// The signed-in installer for this request (from "Authorization: Bearer …").
async function signedIn(request) {
  const h = (request && request.headers) || {};
  const raw = String(h.authorization || h.Authorization || '');
  const m = raw.match(/^Bearer\s+([A-Za-z0-9_\-.]{20,2000})$/);
  if (!m) return null;
  try { return await sessionInstaller(m[1]); } catch (e) { console.warn('session check failed', e && e.message); return null; }
}
async function ownsProject(inst, projectId) {
  return isRecordId(projectId) && !HANDS_OFF_IDS.has(projectId) && installerProjectIds(inst).indexOf(projectId) >= 0;
}
// STEP 1 (Chris, Nov 20 2026): the four hands-off projects never reach any portal (by record id, and by AGC # as a second check).
const HANDS_OFF_IDS = new Set(['recLQXSTZshZiSTkf', 'recQMIMQCdHZTQuQw', 'rec2Rb4zGnPjsqk0D', 'recqnnavmbIOU8K8Y']);   // 17329, 17334, 19043, 19072
const HANDS_OFF_AGC = new Set(['17329', '17334', '19043', '19072']);
function isHandsOff(rec) {
  if (!rec) return true;
  if (HANDS_OFF_IDS.has(rec.id)) return true;
  const f = rec.fields || {};
  const n = String(Array.isArray(f['AGC #']) ? f['AGC #'][0] : (f['AGC #'] == null ? '' : f['AGC #'])).replace(/\D/g, '')
    || ((String(f['PROJECT NAME:'] || '').match(/^\s*(\d{5})\b/) || [])[1] || '');
  return HANDS_OFF_AGC.has(n);
}

// ─── WHAT AN INSTALLER MAY WRITE ─────────────────────────────────────────────
const INSTALLER_WRITABLE = new Set([
  // Step 1 — Profile
  'FIRST NAME', 'LAST NAME', 'EMAIL 1', 'PHONE', 'WEBSITE', 'ADDRESS', 'COMPANY',
  'FACEBOOK', 'INSTAGRAM', 'LINKED IN', 'PROFILE PHOTO', 'SERVICE AREA',
  // Step 2 — Contract
  'Contract First Name', 'Contract Last Name', 'Contract Date', 'Contract Company',
  'DATE SIGNED', 'I AGREE', 'SIGNATURE',
  // Step 3 — Banking / EFT
  'FIRST NAME:', 'LAST NAME:', 'ACCOUNTING EMAIL:', 'BILLING ADDRESS:',
  'NAME OF BANK:', 'BANK COUNTRY:', 'CURRENCY:', 'ACCOUNT NAME:', 'ACCOUNT TYPE:',
  'ACCOUNT NUMBER:', 'TRANSIT NUMBER:', 'INSTITUTION NUMBER:', 'ACH ROUTING NUMBER:', 'VOID CHECK:',
  // Step 4 — Pricing / Skills / Notes
  'HOURLY', 'PRORATED', 'MIN CHARGE', 'CANCELLATION FEE', 'PORTAL NOTES', 'SKILLS',
  'UNIONIZED', 'Unionized', 'AVAILABILITY', 'Availability', 'AVAILABILITY:',
  // Step 5 — Insurance + tax
  'INSURANCE STATUS', 'Liability Insurance Expiry Date', 'Amount Covered:',
  'Insurance Document PDF', 'US TAX FORMS',
  // Step tracking + completion flags the form sets itself
  'Steps Completed', 'COMPLETED EFT APPLICATION', 'LLC CONTRACT SIGNED?'
]);
const PROJECT_WRITABLE = new Set(['INSTALLER INVOICE', 'INVOICE', 'Invoice', 'SHIPMENT CONDITION', 'SHIPMENT NOTES', 'SHIPMENT PHOTOS']);
const CLOSEOUT_WRITABLE = new Set(['RELATED PROJECT', 'STORE', 'INSTALLER', 'CLOSEOUT NOTES', 'CLOSEOUT PHOTOS', 'STATUS', 'SUBMITTED AT:']);

// ─── WHAT AN INSTALLER MAY SEE (allow-lists: anything not named here stays out) ───
// Installer record: what My Profile, Home and the sign-in screen show.
const INSTALLER_READABLE = new Set([...INSTALLER_WRITABLE,
  'SHIPPING TO:', 'STATE / PROVINCE', 'Country', 'SERVICE AREAS',
  'Added AGC to Insurance Policy', 'CONTRACT 2.0', 'VENDOR PORTAL URL',   // STEP 1: no partner STATUS, no INSURANCE AGENT AI text
  'SALUTATION',   // Mr / Miss for ALFRED (Nov 20 2026)
  // 6.156 (Chris, Nov 24 2026: OK): onboarding status and what is missing, the tax form on file, WCB, licences, height training, delivery instructions
  '🤝 ONBOARDING', '🤝 MISSING', '🤝 TAX FORM', '🤝 TAX FORM SIGNED', '🤝 TAX FORM VALID UNTIL',
  '🦺 WORKERS COMP / WCB VALID UNTIL', '🦺 WORKERS COMP / WCB FILES', 'Vendor has WCB',
  '🪪 LICENCES', '🪪 LICENCE FILES', '🦺 HEIGHT TRAINING', 'DELIVERY INSTRUCTIONS',
  'AGC PROJECTS 3', 'AGC PROJECTS 4'
]);
// Project: what the installer needs for the job. Never prices, profit, margins, client details,
// internal notes, PO numbers or AGC's ratings.
const PROJECT_READABLE = new Set([
  'PROJECT NAME:', 'AGC #', 'ID', 'INSTALLER STATUS', '.',
  'DATE SCHEDULED:', 'DATE & TIME SCHEDULED', 'TIME:', 'TIME', 'DUE DATE:', 'DUE DATE.', 'DATE SHIPPED',
  'STORE NAME(s) & ADDRESS(es)', 'STORE NAME(s)', 'STORE ADDRESS', 'ADDRESS: (from STORE NAME(s) & ADDRESS(es))',
  'LOGO (from STORE NAME(s) & ADDRESS(es))', 'STORE CLOSEOUTS',
  'PROJECT SCOPE:', 'IMPORTANT NOTES FOR INSTALLER', 'AGC DIRECTIVES:', 'AGC Photo Requirements', 'AGC REQUIREMENTS',
  'INVOICING REQUIREMENTS PDF', 'PROJECT BRIEF', 'GRAPHIC LOCATION', 'REACH', 'PPE REQUIRED', 'QTY WORKERS', 'Total FT2',
  'SERVICE TYPE', 'PRODUCT / SERVICE 1', 'PRODUCT / SERVICE 2', 'PRODUCT / SERVICE 3', 'PRODUCT / SERVICE 4', 'PRODUCT / SERVICE 5',
  'DATA SHEET', 'LAYOUTS & PLANS', 'PROJECT FILES - INSTALLER', 'INSTALLER PHOTOS', 'INSTALLER CLOSEOUT NOTES',
  'TOTAL BUDGET', 'BUDGET 1', 'BUDGET 2', 'BUDGET 3', 'BUDGET 4', 'BUDGET 5',
  'DETAILS 1', 'DETAILS 2', 'DETAILS 3', 'DETAILS 4', 'DETAILS 5',
  'BUDGET TYPE', 'BUDGET TYPE 2', 'BUDGET TYPE 3', 'BUDGET TYPE 4', 'BUDGET TYPE 5', 'INSTALLER CURRENCY',
  'SHIPPING TO:', 'SHIPPING CO.', 'TRACKING NUMBER', 'Number of PKGS', 'SHIPPING ADDRESS:', 'ONSITE CONTACT',
  'SHIPMENT CONDITION', 'SHIPMENT NOTES', 'SHIPMENT PHOTOS', ' INVOICE FOR REVIEW',
  'AGC PROJECT MANAGER', 'AGC PROJECT MANAGER:', 'PM Name', 'PM Direct',
  // 6.156 (Chris, Nov 24 2026: yes): how firm the date is, revisits, why it is delayed, the lift, AGC's install-day weather note,
  // per-store tracking, the manifest, the site survey and the linked data sheets. Never lift prices.
  '📅 DATE STATUS', '📅 DATE NOTE', 'REASON PROJECT IS DELAYED',
  'REVISIT DATE 1:', 'REVISIT DATE 2:', 'REVISIT DATE 3:', 'REVISIT DATE 4:', 'REVISIT DATE 5:',
  'REVISIT DATE 6:', 'REVISIT DATE 7:', 'REVISIT DATE 8:', 'REVISIT DATE 9:', 'REVISIT DATE 10:',
  'LIFT STATUS', 'Aerial Lift Type (from Aerial Lifts)', 'Supplier (from Aerial Lifts)', 'AERIAL LIFT DETAILS', 'TOTAL DAYS REQUIRED',
  '🌦️ WEATHER', '📦 TRACKING BY STORE', '📦 SHIPPING MANIFEST',
  'SURVEYS', 'Data Sheet (from Data Sheets)', 'Product Name (from Data Sheets)'
  // STEP 1: PROJECT STATUS and STATUS (QuickBooks / client invoice states), the other installers (INSTALLER(S),
  // ADDITIONAL INSTALLER(S), INSTALLER, NAME, PHONE), VENDOR INVOICES and INSTALLER UPDATES are no longer sent.
  // cleanProject adds INSTALLER(S) = this installer only, AGC SHARED JOB (yes / no) and AGC DELAYED (yes / no).
]);

const MASKED_INSTALLER_FIELDS = ['ACCOUNT NUMBER:', 'TRANSIT NUMBER:', 'INSTITUTION NUMBER:', 'ACH ROUTING NUMBER:'];
const mask = (v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ''); return s ? '••••' + s.slice(-4) : ''; };
const isMasked = (v) => typeof v === 'string' && v.indexOf('•') >= 0;

function cleanInstaller(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) {
    if (!INSTALLER_READABLE.has(k)) continue;
    out[k] = MASKED_INSTALLER_FIELDS.indexOf(k) >= 0 ? mask(fields[k]) : fields[k];
    if (k === '🤝 MISSING') out[k] = String(fields[k] || '').split(' \u00b7 ').filter((x) => x.trim() && !/duplicate/i.test(x)).join(' \u00b7 ');   // 6.156: never 'possible duplicate of <another partner>'
    if ((k === 'AGC PROJECTS 3' || k === 'AGC PROJECTS 4') && Array.isArray(out[k])) out[k] = out[k].filter((x) => !HANDS_OFF_IDS.has(typeof x === 'string' ? x : (x && x.id)));   // STEP 1
  }
  return out;
}
// The budget of a job shared by several installers is the whole job's, not this installer's: it is never sent.
const SHARED_JOB_HIDDEN = ['TOTAL BUDGET', 'BUDGET 1', 'BUDGET 2', 'BUDGET 3', 'BUDGET 4', 'BUDGET 5',
  'DETAILS 1', 'DETAILS 2', 'DETAILS 3', 'DETAILS 4', 'DETAILS 5', 'BUDGET TYPE', 'BUDGET TYPE 2', 'BUDGET TYPE 3', 'BUDGET TYPE 4', 'BUDGET TYPE 5'];
const linkIds = (a) => (Array.isArray(a) ? a : []).map((x) => (typeof x === 'string' ? x : (x && x.id) || '')).filter(Boolean);
const selName = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? String(v.name || '') : String(v == null ? '' : v));
function cleanProject(rec, inst) {
  const f = (rec && rec.fields) || {};
  const out = {};
  for (const k of Object.keys(f)) if (PROJECT_READABLE.has(k)) out[k] = f[k];
  const me = inst && inst.id;
  const all = new Set([...linkIds(f['INSTALLER(S)']), ...linkIds(f['ADDITIONAL INSTALLER(S)'])]);
  const shared = all.size > 1;
  out['INSTALLER(S)'] = linkIds(f['INSTALLER(S)']).filter((x) => x === me);     // this installer only, never the others
  out['AGC SHARED JOB'] = shared;
  out['AGC DELAYED'] = /delay/i.test(selName(f['PROJECT STATUS']));            // only "delayed or not", never the status itself
  if (shared) for (const k of SHARED_JOB_HIDDEN) delete out[k];
  // 6.156: these texts are written for the office too. The office-only log lines are cut here, so they never reach the browser or
  // Field Ops ALFRED ('card sent for', 'PDF ... drafted to ...'), and a text that names the owner is not sent at all.
  const keepLines156 = (v, drop) => String(v == null ? '' : v).split('\n').filter((l) => l.trim() && !drop.test(l)).join('\n').trim();
  if (out['🌦️ WEATHER'] != null) out['🌦️ WEATHER'] = keepLines156(out['🌦️ WEATHER'], /^\s*\u{1F514}/u);
  if (out['📦 TRACKING BY STORE'] != null) out['📦 TRACKING BY STORE'] = keepLines156(out['📦 TRACKING BY STORE'], /^\s*\u{1F4C4}|drafted to/iu);
  for (const k of ['📅 DATE NOTE', 'REASON PROJECT IS DELAYED', '🌦️ WEATHER', '📦 TRACKING BY STORE', '📦 SHIPPING MANIFEST', 'AERIAL LIFT DETAILS'])
    if (out[k] != null && (!String(out[k]).trim() || OWNER_NAME.test(String(out[k])))) delete out[k];
  // Nov 23 2026 (Chris: "my name should never be mentioned"): a job Chris manages goes out with no PM name and no PM phone,
  // so the portal and Field Ops ALFRED say "your AGC project manager" and offer Call AGC instead.
  if (PM_FIELDS.some((k) => OWNER_NAME.test(JSON.stringify(out[k] == null ? '' : out[k])))) for (const k of PM_FIELDS) delete out[k];
  return { id: rec.id, createdTime: rec.createdTime, fields: out };
}
const PM_FIELDS = ['AGC PROJECT MANAGER', 'AGC PROJECT MANAGER:', 'PM Name', 'PM Direct'];
const OWNER_NAME = /maassen|\bchristian\b|\bchris\b/i;

// ─── AIRTABLE HELPERS ────────────────────────────────────────────────────────
async function airtableHeaders() {
  const token = await getSecret('AIRTABLE_TOKEN');
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}
async function airtableGET(path) {
  const headers = await airtableHeaders();
  const res = await fetch(AIRTABLE_API + path, { headers });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
async function airtablePATCH(path, fields) {
  const headers = await airtableHeaders();
  const res = await fetch(AIRTABLE_API + path, { method: 'PATCH', headers, body: JSON.stringify({ fields, typecast: true }) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
async function airtablePOST(path, fields) {
  const headers = await airtableHeaders();
  const res = await fetch(AIRTABLE_API + path, { method: 'POST', headers, body: JSON.stringify({ fields, typecast: true }) });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
async function fetchByIds(tableId, ids) {
  const all = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    const formula = 'OR(' + slice.map((id) => 'RECORD_ID()="' + id + '"').join(',') + ')';
    const url = '/' + BASE + '/' + tableId + '?pageSize=100&filterByFormula=' + encodeURIComponent(formula);
    let offset = null;
    do {
      const r = await airtableGET(url + (offset ? '&offset=' + encodeURIComponent(offset) : ''));
      if (!r.ok) break;
      if (Array.isArray(r.body.records)) all.push(...r.body.records);
      offset = r.body.offset || null;
    } while (offset);
  }
  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS PREFLIGHT
// ═══════════════════════════════════════════════════════════════════════════
export function options_getInstaller(request) { return preflight(request); }
export function options_patchInstaller(request) { return preflight(request); }
export function options_createInstaller(request) { return preflight(request); }
export function options_getProjects(request) { return preflight(request); }
export function options_getProject(request) { return preflight(request); }
export function options_patchProject(request) { return preflight(request); }
export function options_getCloseouts(request) { return preflight(request); }
export function options_upsertCloseout(request) { return preflight(request); }
export function options_deleteCloseout(request) { return preflight(request); }
export function options_getStoreNames(request) { return preflight(request); }
export function options_getInstallerSchema(request) { return preflight(request); }
export function options_uploadFile(request) { return preflight(request); }
export function options_uploadInvoiceAttachment(request) { return preflight(request); }
export function options_findProjectByAgcNum(request) { return preflight(request); }
export function options_getProjectInvoiceField(request) { return preflight(request); }
export function options_lkToken() { return response({ status: 204, headers: OPEN_CORS }); }
export function options_office() { return response({ status: 204, headers: OPEN_CORS }); }

// ═══════════════════════════════════════════════════════════════════════════
// INSTALLER
// ═══════════════════════════════════════════════════════════════════════════

// GET /_functions/getInstaller        (the signed-in installer; any ?id= is ignored)
export async function get_getInstaller(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const r = await airtableGET('/' + BASE + '/' + INSTALLERS_TABLE + '/' + inst.id);
    if (r.status === 404) return notFoundJson('installer not found', request);
    if (!r.ok) { console.warn('getInstaller airtable error', r.status); return serverErrorJson('airtable read failed', request); }
    return okJson({ id: r.body.id, createdTime: r.body.createdTime, fields: cleanInstaller(r.body.fields) }, request);
  } catch (e) { console.error('getInstaller', e); return serverErrorJson(null, request); }
}

// POST /_functions/patchInstaller   body: { fields }   (the record is the signed-in installer's)
// 4xx errors from Airtable are passed through so My Profile's self-heal can drop an unknown field.
export async function post_patchInstaller(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    const fields = pickFields(body && body.fields, INSTALLER_WRITABLE);
    for (const k of Object.keys(fields)) if (isMasked(fields[k])) delete fields[k];   // never write the mask over the real number
    if (Object.keys(fields).length === 0) return okJson({ id: inst.id, fields: {}, unchanged: true }, request);
    const r = await airtablePATCH('/' + BASE + '/' + INSTALLERS_TABLE + '/' + inst.id, fields);
    if (!r.ok) {
      console.warn('patchInstaller airtable error', r.status);
      if (r.status >= 400 && r.status < 500) return response({ status: r.status, headers: corsFor(request), body: r.body });
      return serverErrorJson('airtable write failed', request);
    }
    return okJson({ id: r.body.id, fields: cleanInstaller(r.body.fields) }, request);
  } catch (e) { console.error('patchInstaller', e); return serverErrorJson(null, request); }
}

// POST /_functions/createInstaller  body: { fields }   (a brand-new partner from "Set up your profile")
// Open on purpose (nobody has an account yet); only profile fields, never the password.
export async function post_createInstaller(request) {
  try {
    const body = await request.body.json();
    const fields = pickFields(body && body.fields, INSTALLER_WRITABLE);
    for (const k of Object.keys(fields)) if (isMasked(fields[k])) delete fields[k];
    if (!isStr(fields['EMAIL 1'], 200) || !/@/.test(fields['EMAIL 1'])) return badRequestJson('an email address is needed', request);
    const r = await airtablePOST('/' + BASE + '/' + INSTALLERS_TABLE, fields);
    if (!r.ok) { console.warn('createInstaller airtable error', r.status); return serverErrorJson('airtable write failed', request); }
    return createdJson({ id: r.body.id, fields: cleanInstaller(r.body.fields) }, request);
  } catch (e) { console.error('createInstaller', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS (only the signed-in installer's)
// ═══════════════════════════════════════════════════════════════════════════

// GET /_functions/getProjects
export async function get_getProjects(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const ids = installerProjectIds(inst);
    if (!ids.length) return okJson({ records: [] }, request);
    const recs = await fetchByIds(PROJECTS_TABLE, ids.filter((id) => !HANDS_OFF_IDS.has(id)));
    return okJson({ records: recs.filter((r) => !isHandsOff(r)).map((r) => cleanProject(r, inst)), linkedFieldName: 'AGC PROJECTS' }, request);
  } catch (e) { console.error('getProjects', e); return serverErrorJson(null, request); }
}

// GET /_functions/getProject?id=recXXX
export async function get_getProject(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const id = request.query && request.query.id;
    if (!isRecordId(id)) return badRequestJson('invalid project id', request);
    if (!(await ownsProject(inst, id))) return forbiddenJson(request);
    const r = await airtableGET('/' + BASE + '/' + PROJECTS_TABLE + '/' + id);
    if (r.status === 404) return notFoundJson('project not found', request);
    if (!r.ok) return serverErrorJson('airtable read failed', request);
    if (isHandsOff(r.body)) return forbiddenJson(request);
    return okJson(cleanProject(r.body, inst), request);
  } catch (e) { console.error('getProject', e); return serverErrorJson(null, request); }
}

// POST /_functions/patchProject   body: { id, fields }
export async function post_patchProject(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    if (!body || !isRecordId(body.id)) return badRequestJson('invalid project id', request);
    if (!(await ownsProject(inst, body.id))) return forbiddenJson(request);
    const fields = pickFields(body.fields, PROJECT_WRITABLE);
    if (Object.keys(fields).length === 0) return badRequestJson('no writable fields', request);
    const r = await airtablePATCH('/' + BASE + '/' + PROJECTS_TABLE + '/' + body.id, fields);
    if (!r.ok) { console.warn('patchProject airtable error', r.status); return serverErrorJson('airtable write failed', request); }
    return okJson(cleanProject(r.body, inst), request);
  } catch (e) { console.error('patchProject', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOSEOUTS (only on the signed-in installer's projects)
// ═══════════════════════════════════════════════════════════════════════════

// GET /_functions/getCloseouts?projectId=recXXX
export async function get_getCloseouts(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const projectId = request.query && request.query.projectId;
    if (!isRecordId(projectId)) return badRequestJson('invalid project id', request);
    if (!(await ownsProject(inst, projectId))) return forbiddenJson(request);
    const formula = 'FIND("' + projectId + '", ARRAYJOIN({RELATED PROJECT}))';
    const url = '/' + BASE + '/' + CLOSEOUTS_TABLE + '?pageSize=100&filterByFormula=' + encodeURIComponent(formula);
    const all = [];
    let offset = null;
    do {
      const r = await airtableGET(url + (offset ? '&offset=' + encodeURIComponent(offset) : ''));
      if (!r.ok) return serverErrorJson('airtable read failed', request);
      if (Array.isArray(r.body.records)) all.push(...r.body.records);
      offset = r.body.offset || null;
    } while (offset);
    return okJson({ records: all }, request);
  } catch (e) { console.error('getCloseouts', e); return serverErrorJson(null, request); }
}

async function closeoutProjects(closeoutId) {
  const r = await airtableGET('/' + BASE + '/' + CLOSEOUTS_TABLE + '/' + closeoutId);
  if (!r.ok) return null;
  const f = (r.body && r.body.fields) || {};
  return { projects: Array.isArray(f['RELATED PROJECT']) ? f['RELATED PROJECT'] : [], installers: Array.isArray(f['INSTALLER']) ? f['INSTALLER'] : [] };
}
async function ownsCloseout(inst, closeoutId) {
  if (!isRecordId(closeoutId)) return false;
  const c = await closeoutProjects(closeoutId);
  if (!c) return false;
  if (c.installers.indexOf(inst.id) >= 0) return true;
  const mine = installerProjectIds(inst);
  return c.projects.some((p) => mine.indexOf(p) >= 0);
}

// POST /_functions/upsertCloseout   body: { id?, fields }
export async function post_upsertCloseout(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    const fields = pickFields(body && body.fields, CLOSEOUT_WRITABLE);
    if (Object.keys(fields).length === 0) return badRequestJson('no writable fields', request);
    // The closeout is always this installer's, on one of this installer's projects.
    fields['INSTALLER'] = [inst.id];
    if (fields['RELATED PROJECT'] !== undefined) {
      const rel = (Array.isArray(fields['RELATED PROJECT']) ? fields['RELATED PROJECT'] : [fields['RELATED PROJECT']]).map((x) => (x && x.id) || x);
      const mine = installerProjectIds(inst);
      if (!rel.length || rel.some((p) => mine.indexOf(p) < 0)) return forbiddenJson(request);
      fields['RELATED PROJECT'] = rel;
    }
    if (body && body.id) {
      if (!isRecordId(body.id)) return badRequestJson('invalid closeout id', request);
      if (!(await ownsCloseout(inst, body.id))) return forbiddenJson(request);
      const r = await airtablePATCH('/' + BASE + '/' + CLOSEOUTS_TABLE + '/' + body.id, fields);
      if (!r.ok) { console.warn('upsertCloseout PATCH error', r.status); return serverErrorJson('airtable write failed', request); }
      return okJson(r.body, request);
    }
    if (fields['RELATED PROJECT'] === undefined) return badRequestJson('which project is this closeout for?', request);
    const r = await airtablePOST('/' + BASE + '/' + CLOSEOUTS_TABLE, fields);
    if (!r.ok) { console.warn('upsertCloseout POST error', r.status); return serverErrorJson('airtable write failed', request); }
    return createdJson(r.body, request);
  } catch (e) { console.error('upsertCloseout', e); return serverErrorJson(null, request); }
}

// POST /_functions/deleteCloseout   body: { id }
export async function post_deleteCloseout(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    if (!body || !isRecordId(body.id)) return badRequestJson('invalid closeout id', request);
    if (!(await ownsCloseout(inst, body.id))) return forbiddenJson(request);
    const headers = await airtableHeaders();
    const res = await fetch(AIRTABLE_API + '/' + BASE + '/' + CLOSEOUTS_TABLE + '/' + body.id, { method: 'DELETE', headers });
    if (!res.ok) { console.warn('deleteCloseout error', res.status); return serverErrorJson('airtable delete failed', request); }
    return okJson({ ok: true, id: body.id }, request);
  } catch (e) { console.error('deleteCloseout', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// INVOICE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

// POST /_functions/findProjectByAgcNum   body: { agcNum }   → { projectId }, only for the installer's own projects
export async function post_findProjectByAgcNum(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    const agcNum = String((body && body.agcNum) || '').trim();
    if (!/^[0-9]{3,7}$/.test(agcNum)) return badRequestJson('invalid agc number', request);
    const mine = installerProjectIds(inst);
    if (!mine.length) return notFoundJson('no project with that AGC #', request);
    const recs = (await fetchByIds(PROJECTS_TABLE, mine.filter((id) => !HANDS_OFF_IDS.has(id)))).filter((r) => !isHandsOff(r));
    const hit = recs.find((r) => String((r.fields || {})['AGC #'] || '') === agcNum);
    if (!hit) return notFoundJson('no project with that AGC #', request);
    return okJson({ projectId: hit.id }, request);
  } catch (e) { console.error('findProjectByAgcNum', e); return serverErrorJson(null, request); }
}

let _invoiceField = null;
async function invoiceField() {
  if (_invoiceField) return _invoiceField;
  const r = await airtableGET('/meta/bases/' + BASE + '/tables');
  if (!r.ok) return null;
  const tbl = ((r.body && r.body.tables) || []).find((t) => t.id === PROJECTS_TABLE);
  const fld = tbl && (tbl.fields || []).find((f) => (f.name || '').trim().toUpperCase() === 'INVOICE FOR REVIEW');
  if (fld && fld.type === 'multipleAttachments') _invoiceField = { fieldId: fld.id, fieldName: fld.name };
  return _invoiceField;
}

// GET /_functions/getProjectInvoiceField   → { fieldId, fieldName } of INVOICE FOR REVIEW
export async function get_getProjectInvoiceField(request) {
  try {
    const f = await invoiceField();
    if (!f) return notFoundJson('field not found', request);
    return okJson(f, request);
  } catch (e) { console.error('getProjectInvoiceField', e); return serverErrorJson(null, request); }
}

// POST /_functions/uploadInvoiceAttachment   body: { projectId, contentType, file (base64), filename }
// Always goes to the project's INVOICE FOR REVIEW field, only on the installer's own project.
export async function post_uploadInvoiceAttachment(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    if (!body || !isRecordId(body.projectId)) return badRequestJson('invalid project id', request);
    if (!(await ownsProject(inst, body.projectId))) return forbiddenJson(request);
    if (!isStr(body.file, 16 * 1024 * 1024)) return badRequestJson('missing file', request);
    if (!isStr(body.contentType, 200)) return badRequestJson('invalid contentType', request);
    if (!isStr(body.filename, 300)) return badRequestJson('invalid filename', request);
    if (Math.floor(body.file.length * 0.75) > MAX_FILE_BYTES) return badRequestJson('file too large', request);
    const f = await invoiceField();
    if (!f) return serverErrorJson('invoice field missing', request);
    const token = await getSecret('AIRTABLE_TOKEN');
    const r = await fetch(AIRTABLE_CONTENT + '/' + BASE + '/' + body.projectId + '/' + f.fieldId + '/uploadAttachment', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: body.contentType, file: body.file, filename: body.filename })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.warn('uploadInvoiceAttachment error', r.status); return serverErrorJson('attachment upload failed', request); }
    return okJson({ id: j.id, ok: true }, request);
  } catch (e) { console.error('uploadInvoiceAttachment', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE NAMES (for the installer's projects)
// ═══════════════════════════════════════════════════════════════════════════

// POST /_functions/getStoreNames   body: { ids: [...] }   → { names: { recId: "Store name" } }
export async function post_getStoreNames(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    const ids = (body && body.ids) || [];
    if (!Array.isArray(ids)) return badRequestJson('ids must be an array', request);
    if (ids.length > 200) return badRequestJson('too many ids (max 200)', request);
    const clean = ids.filter(isRecordId);
    if (!clean.length) return okJson({ names: {} }, request);
    const recs = await fetchByIds(STORES_TABLE, clean);
    const out = {};
    for (const rec of recs) {
      const f = rec.fields || {};
      const name = f['Name'] || f['STORE NAME'] || f['Store Name'] || f['NAME'] || f['Store'] || f['STORE'] || Object.values(f)[0];
      out[rec.id] = typeof name === 'string' ? name : String(name == null ? '' : name);
    }
    return okJson({ names: out }, request);
  } catch (e) { console.error('getStoreNames', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA (SKILLS choices + union / availability options only)
// ═══════════════════════════════════════════════════════════════════════════
export async function get_getInstallerSchema(request) {
  try {
    const r = await airtableGET('/meta/bases/' + BASE + '/tables');
    if (!r.ok) return serverErrorJson('schema fetch failed', request);
    const inst = ((r.body && r.body.tables) || []).find((t) => t.id === INSTALLERS_TABLE);
    if (!inst) return serverErrorJson('installers table missing', request);
    const fields = inst.fields || [];
    const skills = fields.find((f) => f.name === 'SKILLS');
    const skillOptions = skills && skills.options && skills.options.choices ? skills.options.choices.map((c) => c.name) : [];
    const info = (fld) => fld ? { name: fld.name, type: fld.type, options: (fld.type === 'singleSelect' && fld.options && fld.options.choices) ? fld.options.choices.map((c) => c.name) : [] } : null;
    return okJson({ skills: skillOptions, union: info(fields.find((f) => /union/i.test(f.name))), availability: info(fields.find((f) => /^avail/i.test(f.name))) }, request);
  } catch (e) { console.error('getInstallerSchema', e); return serverErrorJson(null, request); }
}

// ═════════════════════════════════════════════════════════════════════
// FIELD OPS ALFRED (Installer Portal chat) · steps 2 + 3 (Chris, Nov 23 2026)
//   GET  /_functions/alfredRules   the ACTIVE rows of 🎛️ FIELD OPS ALFRED RULES + the built-in never-share list (backend/fieldOpsAlfred.js)
//   POST /_functions/alfredLog     one row in 💬 FIELD OPS ALFRED LOG: the installer comes from the session, the project is linked
//                                  only when it is one of theirs (hands-off projects never), every text is cut to a safe length
// ═════════════════════════════════════════════════════════════════════
export function options_alfredRules(request) { return preflight(request); }
export function options_alfredLog(request) { return preflight(request); }
export async function get_alfredRules(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    return okJson(Object.assign({}, await rulesForPortal(), { ai: await aiEnabledFor(inst) }), request);   // ai: this installer is on the AI switch
  } catch (e) { console.error('alfredRules', e); return serverErrorJson(null, request); }
}
export async function post_alfredLog(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json().catch(() => ({}));
    const pid = isRecordId(body && body.projectId) && await ownsProject(inst, body.projectId) ? body.projectId : '';
    const r = await writeLog(inst, body, pid);
    if (!r.ok) return r.status === 400 ? badRequestJson('missing question', request) : serverErrorJson('log failed', request);
    return createdJson({ ok: true }, request);
  } catch (e) { console.error('alfredLog', e); return serverErrorJson(null, request); }
}
// GET /_functions/alfredAiContext   (🤖 the installer AI service, field-ops-alfred on Cloudflare, calls this with the installer's own
//   sign-in; nothing the browser sends is used.) Off the switch = { enabled: false } and no data. On the switch = the rules plus exactly
//   what getInstaller and getProjects give this installer: the same allow-lists, the hands-off projects never.
export function options_alfredAiContext(request) { return preflight(request); }
export async function get_alfredAiContext(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    if (!(await aiEnabledFor(inst))) return okJson({ enabled: false }, request);
    const r = await airtableGET('/' + BASE + '/' + INSTALLERS_TABLE + '/' + inst.id);
    if (!r.ok) return serverErrorJson('airtable read failed', request);
    const ids = installerProjectIds(inst).filter((id) => !HANDS_OFF_IDS.has(id));
    const recs = ids.length ? await fetchByIds(PROJECTS_TABLE, ids) : [];
    const projects = recs.filter((x) => !isHandsOff(x)).map((x) => aiProject(cleanProject(x, inst)));
    // services go to the AI by name, never as record ids
    const sIds = [...new Set(projects.flatMap((p) => AI_SERVICE_FIELDS.flatMap((k) => linkIds(p.fields[k]))))];
    const sRecs = sIds.length ? await fetchByIds(SERVICES_TABLE, sIds) : [];
    const sName = new Map(sRecs.map((x) => [x.id, String((x.fields || {})['SERVICE TYPE'] || '').trim()]));
    for (const p of projects) for (const k of AI_SERVICE_FIELDS) if (p.fields[k] != null) {
      const names = linkIds(p.fields[k]).map((id) => sName.get(id)).filter(Boolean);
      if (names.length) p.fields[k] = names; else delete p.fields[k];
    }
    // store hours (Chris, Nov 23 2026): each linked store by NAME with its STORE HOURS (the Google Maps hours, the trusted source);
    // the project's TIME / TIME: (install time or after-hours note) overrides them, and the AI is told so. Store ids never reach the AI.
    const stIds = [...new Set(projects.flatMap((p) => linkIds(p.fields[AI_STORE_FIELD])))];
    const stRecs = stIds.length ? await fetchByIds(STORES_TABLE, stIds) : [];
    const stBy = new Map(stRecs.map((x) => [x.id, x.fields || {}]));
    for (const p of projects) {
      const ids = linkIds(p.fields[AI_STORE_FIELD]);
      if (p.fields[AI_STORE_FIELD] != null) delete p.fields[AI_STORE_FIELD];
      const list = ids.map((id) => stBy.get(id)).filter(Boolean).map((f) => ({ store: String(f['Store Name'] || '').trim(),
        address: String(f['Store Address'] || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        hours: String(f['STORE HOURS'] || '').trim() || 'not on file' })).filter((x) => x.store);
      if (list.length) p.fields['STORES (Google Maps hours)'] = list;
    }
    // 🧰 equipment (Chris, Nov 23 2026: the PMs approved the rules): each job's 🧰 SUGGESTED EQUIPMENT rules that are ✅ APPROVED or
    // ✏️ CHANGED, as "rule: what to bring". 🟡 TO REVIEW and ❌ REMOVED rules never reach the AI.
    const eqOf = new Map(recs.map((x) => [x.id, linkIds((x.fields || {})['🧰 SUGGESTED EQUIPMENT'])]));
    const eqIds = [...new Set([].concat(...eqOf.values()))];
    const eqRecs = eqIds.length ? await fetchByIds(EQUIPMENT_TABLE, eqIds) : [];
    const eqBy = new Map(eqRecs.filter((x) => /APPROVED|CHANGED/.test(String(((x.fields || {}).STATUS || {}).name || (x.fields || {}).STATUS || ''))).map((x) => [x.id, x.fields || {}]));
    for (const p of projects) {
      const list = (eqOf.get(p.id) || []).map((id) => eqBy.get(id)).filter(Boolean)
        .map((f) => String(f['RULE'] || '').trim() + ': ' + String(f['WHAT TO BRING'] || '').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 2);
      if (list.length) p.fields['EQUIPMENT TO BRING (approved by AGC)'] = list;
    }
    // STEP 4 (Chris, Nov 23 2026: "lets do it"): holidays, the installer's own bill, the directive PDF.
    //  - 🕘 HOURS + HOLIDAYS: the job's store-hours and public-holiday check, WITHOUT its "👥 AGC Holiday Calendar" line (it names people on leave).
    //  - 🧾 QBO BILL: only the lines whose vendor is this installer (QBO VENDOR NAME, else COMPANY), and only "paid" or "not paid yet":
    //    no amounts, no mismatch notes. The 📒 QBO fields, 💸 PAYMENT ON THE WAY and DATE PAID are the CLIENT's money and never go out.
    //  - AGC DIRECTIVES: the job's directive PDF (name + link; the AI service reads it when asked about the directive).
    const venNames = [r.body.fields['QBO VENDOR NAME'], r.body.fields['COMPANY']].map((n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean);
    const isMine = (vendor) => { const v = String(vendor || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return !!v && venNames.some((n) => v === n || v.startsWith(n + ' ') || n.startsWith(v + ' ')); };
    const rawBy = new Map(recs.map((x) => [x.id, x.fields || {}]));
    for (const p of projects) {
      const f = rawBy.get(p.id) || {};
      const hh = String(f['🕘 HOURS + HOLIDAYS'] || '').split('\n').filter((l) => l.trim() && !/^\s*👥/.test(l)).join('\n').trim();
      if (hh) p.fields['STORE HOURS + HOLIDAY CHECK'] = hh;
      const bills = String(f['🧾 QBO BILL'] || '').split('\n').filter((l) => l.trim() && !/^\s*⚠/.test(l)).map((l) => l.split(' · ').map((x) => x.trim()))
        .filter((b) => b.length >= 3 && isMine(b[0])).map((b) => {
          // Nov 23 2026 (Chris: yes): status and due date are found by their label, not by position (a shared bill ends with
          // 'one bill for AGC ...', and unpaid bills now carry 'due <date>' from the QuickBooks bill). Amounts still never go out.
          const ref = (b.find((x) => /^ref\s/i.test(x)) || '').replace(/^ref\s*/i, ''), dated = b.find((x) => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(x)) || '';
          const stx = b.find((x) => /^(PART PAID|PAID|OPEN)\b/i.test(x)) || '', due = (b.find((x) => /^due\s/i.test(x)) || '').replace(/^due\s*/i, '');
          const st = /^PART PAID/i.test(stx) ? 'partly paid' : /^OPEN/i.test(stx) ? 'not paid yet' : /^PAID/i.test(stx) ? 'paid' : 'status not clear, ask AGC accounting';
          return 'Your invoice' + (ref ? ' ' + ref : '') + (dated ? ' (dated ' + dated + ')' : '') + ': ' + st + (due && st !== 'paid' ? '; due date in AGC\'s books: ' + due : ''); });
      if (bills.length) p.fields['YOUR BILL TO AGC (payment status)'] = bills;
      const dirs = (Array.isArray(f['AGC DIRECTIVES:']) ? f['AGC DIRECTIVES:'] : []).filter((a) => a && a.url && /pdf/i.test(String(a.type || a.filename || '')));
      if (dirs.length) p.fields['DIRECTIVE PDF'] = dirs.slice(0, 2).map((a) => ({ name: String(a.filename || 'Directive.pdf'), url: a.url }));
    }
    // the days AGC's office is closed: AGC Holiday Calendar rows named "... AGC CLOSED" (never anyone's leave); a job that lands on one is flagged
    let agcClosed = [];
    try {
      const hq = '?pageSize=50&filterByFormula=' + encodeURIComponent("AND(FIND('AGC CLOSED',UPPER({Name})),IS_AFTER(IF({End Date},{End Date},{Start Date}),DATEADD(TODAY(),-1,'days')))");
      const hr = await airtableGET('/' + BASE + '/' + HOLIDAY_TABLE + hq);
      if (hr.ok) agcClosed = ((hr.body && hr.body.records) || []).map((x) => ({ name: String((x.fields || {})['Name'] || '').trim(), from: String((x.fields || {})['Start Date'] || ''),
        to: String((x.fields || {})['End Date'] || (x.fields || {})['Start Date'] || '') })).filter((x) => x.from).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 12);
    } catch (e) { console.warn('alfredAiContext holidays', e && e.message); }
    for (const p of projects) { const d = String(p.fields['DATE SCHEDULED:'] || '').slice(0, 10), hit = d && agcClosed.find((c) => d >= c.from && d <= c.to);
      if (hit) p.fields['AGC CLOSED ON INSTALL DAY'] = hit.name + ' (' + hit.from + ' to ' + hit.to + ')'; }
    return okJson({ enabled: true, installerId: inst.id, staff: !!inst.__staff, rules: await rulesForPortal(),
      installer: aiInstaller(cleanInstaller(r.body.fields)), projects, agcClosed }, request);
  } catch (e) { console.error('alfredAiContext', e); return serverErrorJson(null, request); }
}
// The AI copy only (Chris, Nov 23 2026): the portal's allow-lists, then less. Banking, signature, portal link and profile photo stay
// out; and, as a second lock, any field whose name sounds like a rating, a score, a work style / people profile or an internal note
// is dropped even if someone adds it to an allow-list later. Notes that DO reach the AI: installer PORTAL NOTES (their own words);
// project IMPORTANT NOTES FOR INSTALLER, INSTALLER CLOSEOUT NOTES, SHIPMENT NOTES, PROJECT SCOPE:, PROJECT BRIEF, AGC DIRECTIVES:,
// AGC REQUIREMENTS, AGC Photo Requirements, DETAILS 1 to 5 (their own budget lines, never on shared jobs).
const SERVICES_TABLE = 'tblIA61JoHA5owTg2';   // ⚙️ SERVICE TYPES
const HOLIDAY_TABLE = 'tblN3LmMIb3auuWMQ';   // AGC Holiday Calendar (only the "AGC CLOSED" rows are read)
const EQUIPMENT_TABLE = 'tbla3ZKTLFAA13UnF';   // 🧰 EQUIPMENT RULES (RULE, WHAT TO BRING, STATUS)
const AI_STORE_FIELD = 'STORE NAME(s) & ADDRESS(es)';   // linked 🏬 STORES & LOCATIONS (Store Name, Store Address, STORE HOURS)
const AI_SERVICE_FIELDS = ['PRODUCT / SERVICE 1', 'PRODUCT / SERVICE 2', 'PRODUCT / SERVICE 3', 'PRODUCT / SERVICE 4', 'PRODUCT / SERVICE 5'];
const AI_INSTALLER_OUT = new Set(['FIRST NAME:', 'LAST NAME:', 'ACCOUNTING EMAIL:', 'BILLING ADDRESS:', 'NAME OF BANK:', 'BANK COUNTRY:', 'CURRENCY:',
  'ACCOUNT NAME:', 'ACCOUNT TYPE:', 'ACCOUNT NUMBER:', 'TRANSIT NUMBER:', 'INSTITUTION NUMBER:', 'ACH ROUTING NUMBER:', 'VOID CHECK:',
  'SIGNATURE', 'VENDOR PORTAL URL', 'PROFILE PHOTO']);
const AI_NEVER = /RATING|SCORE|STYLE|PEOPLE PROFILE|PERSONALITY|INTERNAL|PM NOTE|AGC NOTE|SENIOR PM|PARTNER STATUS|INSURANCE AGENT|^NOTES$|VENDOR PORTAL NOTES/i;
function aiInstaller(f) { const o = {}; for (const k of Object.keys(f || {})) if (!AI_INSTALLER_OUT.has(k) && !AI_NEVER.test(k)) o[k] = f[k]; return o; }
function aiProject(p) { const o = {}; for (const k of Object.keys(p.fields || {})) if (!AI_NEVER.test(k)) o[k] = p.fields[k]; return { id: p.id, createdTime: p.createdTime, fields: o }; }

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOADS (ImgBB, signed-in installers only)
// ═══════════════════════════════════════════════════════════════════════════
export async function post_uploadFile(request) {
  try {
    const inst = await signedIn(request);
    if (!inst) return authJson(request);
    const body = await request.body.json();
    if (!body || !isStr(body.data, 16 * 1024 * 1024)) return badRequestJson('missing data', request);
    if (Math.floor(body.data.length * 0.75) > MAX_FILE_BYTES) return badRequestJson('file too large', request);
    const imgbbKey = await getSecret('IMGBB_KEY');
    const form = 'image=' + encodeURIComponent(body.data) + (body.filename ? '&name=' + encodeURIComponent(String(body.filename).slice(0, 200)) : '');
    const r = await fetch(IMGBB_UPLOAD + '?key=' + encodeURIComponent(imgbbKey), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success || !j.data) { console.warn('imgbb upload error', r.status); return serverErrorJson('upload failed', request); }
    return okJson({ url: j.data.url, display_url: j.data.display_url, thumb_url: j.data.thumb && j.data.thumb.url, delete_url: j.data.delete_url }, request);
  } catch (e) { console.error('uploadFile', e); return serverErrorJson(null, request); }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGC-PORTAL-PART-END: in Wix, the LiveKit token endpoint (post_lkToken) and
// the virtual office page (get_office) follow here, unchanged.
