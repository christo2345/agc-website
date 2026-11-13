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
  return isRecordId(projectId) && installerProjectIds(inst).indexOf(projectId) >= 0;
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
  'SHIPPING TO:', 'STATUS', 'STATE / PROVINCE', 'Country', 'SERVICE AREAS',
  'Added AGC to Insurance Policy', 'INSURANCE AGENT', 'CONTRACT 2.0', 'VENDOR PORTAL URL',
  'AGC PROJECTS 3', 'AGC PROJECTS 4'
]);
// Project: what the installer needs for the job. Never prices, profit, margins, client details,
// internal notes, PO numbers or AGC's ratings.
const PROJECT_READABLE = new Set([
  'PROJECT NAME:', 'AGC #', 'ID', 'PROJECT STATUS', 'STATUS', 'INSTALLER STATUS', '.',
  'DATE SCHEDULED:', 'DATE & TIME SCHEDULED', 'TIME:', 'TIME', 'DUE DATE:', 'DUE DATE.', 'DATE SHIPPED',
  'STORE NAME(s) & ADDRESS(es)', 'STORE NAME(s)', 'STORE ADDRESS', 'ADDRESS: (from STORE NAME(s) & ADDRESS(es))',
  'LOGO (from STORE NAME(s) & ADDRESS(es))', 'STORE CLOSEOUTS',
  'PROJECT SCOPE:', 'IMPORTANT NOTES FOR INSTALLER', 'AGC DIRECTIVES:', 'AGC Photo Requirements', 'AGC REQUIREMENTS',
  'INVOICING REQUIREMENTS PDF', 'PROJECT BRIEF', 'GRAPHIC LOCATION', 'REACH', 'PPE REQUIRED', 'QTY WORKERS', 'Total FT2',
  'SERVICE TYPE', 'PRODUCT / SERVICE 1', 'PRODUCT / SERVICE 2', 'PRODUCT / SERVICE 3', 'PRODUCT / SERVICE 4', 'PRODUCT / SERVICE 5',
  'DATA SHEET', 'LAYOUTS & PLANS', 'PROJECT FILES - INSTALLER', 'INSTALLER PHOTOS', 'INSTALLER CLOSEOUT NOTES', 'INSTALLER UPDATES',
  'TOTAL BUDGET', 'BUDGET 1', 'BUDGET 2', 'BUDGET 3', 'BUDGET 4', 'BUDGET 5',
  'DETAILS 1', 'DETAILS 2', 'DETAILS 3', 'DETAILS 4', 'DETAILS 5',
  'BUDGET TYPE', 'BUDGET TYPE 2', 'BUDGET TYPE 3', 'BUDGET TYPE 4', 'BUDGET TYPE 5', 'INSTALLER CURRENCY',
  'SHIPPING TO:', 'SHIPPING CO.', 'TRACKING NUMBER', 'Number of PKGS', 'SHIPPING ADDRESS:', 'ONSITE CONTACT',
  'SHIPMENT CONDITION', 'SHIPMENT NOTES', 'SHIPMENT PHOTOS', ' INVOICE FOR REVIEW', 'VENDOR INVOICES',
  'AGC PROJECT MANAGER', 'AGC PROJECT MANAGER:', 'PM Name', 'PM Direct',
  'INSTALLER(S)', 'ADDITIONAL INSTALLER(S)', 'INSTALLER', 'NAME (from INSTALLER(S))', 'PHONE'
]);

const MASKED_INSTALLER_FIELDS = ['ACCOUNT NUMBER:', 'TRANSIT NUMBER:', 'INSTITUTION NUMBER:', 'ACH ROUTING NUMBER:'];
const mask = (v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ''); return s ? '••••' + s.slice(-4) : ''; };
const isMasked = (v) => typeof v === 'string' && v.indexOf('•') >= 0;

function cleanInstaller(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) {
    if (!INSTALLER_READABLE.has(k)) continue;
    out[k] = MASKED_INSTALLER_FIELDS.indexOf(k) >= 0 ? mask(fields[k]) : fields[k];
  }
  return out;
}
function cleanProject(rec) {
  const f = (rec && rec.fields) || {};
  const out = {};
  for (const k of Object.keys(f)) if (PROJECT_READABLE.has(k)) out[k] = f[k];
  return { id: rec.id, createdTime: rec.createdTime, fields: out };
}

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
    const recs = await fetchByIds(PROJECTS_TABLE, ids);
    return okJson({ records: recs.map(cleanProject), linkedFieldName: 'AGC PROJECTS' }, request);
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
    return okJson(cleanProject(r.body), request);
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
    return okJson(cleanProject(r.body), request);
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
    const recs = await fetchByIds(PROJECTS_TABLE, mine);
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
