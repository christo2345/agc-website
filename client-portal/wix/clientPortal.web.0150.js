// ═══════════════════════════════════════════════════════════════════════════
//  backend/clientPortal.web.js — AGC Client Portal (Wix Velo backend)
//  Portal version 0.14.27 (matches the number beside BETA in the HTML)
// ═══════════════════════════════════════════════════════════════════════════
//  Serves every data request from the client portal HTML. The Airtable key
//  never leaves the server. Clients can read their own projects and update
//  the shipping fields on them (CLIENT_EDITABLE_FIELDS); nothing else.
//
//  SETUP
//   1. Secrets Manager → a secret named as AIRTABLE_SECRET_NAME below holding
//      an Airtable personal access token (data.records:read + write, AGC
//      base only). Rotate the old tokens that were embedded in HTML pages.
//      Tables it touches: AGC PROJECTS (read; writes shipping fields,
//      PO Received, and PROJECT STATUS / Reason Project Cancelled when a
//      client cancels a project), AGC CLIENTS (read; writes PASSWORD and LOGO), PORTAL
//      UPDATES (read/create), PURCHASE ORDERS (names; creates the POs clients
//      upload from Pricing, with their file), SERVICE TYPES and the A/R
//      company table (names / payment terms only).
//   2. Optional: in Airtable add a link field on PORTAL UPDATES pointing to
//      🧑🏼‍💼 AGC CLIENTS, named exactly as FEEDBACK_CLIENT_FIELD below, so
//      clients can see their past feedback.
//   3. Optional: a secret named as STAFF_SECRET_NAME (AGC staff password).
//   4. Save this file as backend/clientPortal.web.js and add the page code
//      (client-portal-page.js) to the page holding the HTML component.
//      The page does NOT need to be members-only: the portal has its own
//      sign-in (see "Sign-in" below).
//
//  WHO CAN SEE WHAT
//   A contact sees projects where they are the CLIENT or one of the
//   RELATED CLIENT CONTACT(s) (or, if SHARE_ACROSS_COMPANY is true, any
//   project at the same LINKED COMPANY).
// ═══════════════════════════════════════════════════════════════════════════
import { Permissions, webMethod } from 'wix-web-module';
import crypto from 'crypto';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

// ── Airtable layout ─────────────────────────────────────────────────────────
// Name of the Wix secret (Secrets Manager) that holds the Airtable token.
const AIRTABLE_SECRET_NAME = 'AGCClientPortalWix';

const BASE      = 'app7LeveIY3JoIqBp';
const PROJECTS  = 'tblziZ2NmNH2m3HfJ';   // AGC PROJECTS
const CLIENTS   = 'tbluPxLbv2umXMK01';   // 🧑🏼‍💼 AGC CLIENTS
const FEEDBACK  = 'tblpXDJaUe4DXyl0A';   // PORTAL UPDATES
const CLIENT_LOGO_FIELD_ID = 'fldCTIBZ8hzbE71T3';  // AGC CLIENTS → LOGO

const FEEDBACK_CLIENT_FIELD = 'Submitted By (Client)';   // ← create this link field (step 2)

// Let every contact at the same company see the company's projects.
// Off: a contact sees projects where they are the CLIENT or one of the
// RELATED CLIENT CONTACT(s). On: they also see every project whose client
// contact belongs to the same LINKED COMPANY (e.g. all of ICON's projects).
const SHARE_ACROSS_COMPANY = false;

// PROJECT STATUS values where the install date isn't set yet: any date in
// Airtable is only a placeholder, so clients see no date (not "scheduled").
const UNSCHEDULED_STATUS = /AWAITING APPROVAL|NEW PROJECT|READY FOR ESTIMATE|NEED TO SCHEDULE|PLACE ?HOLDER|DEPOSIT REQUIRED/i;
const notScheduledYet = f => UNSCHEDULED_STATUS.test(statusName(f['PROJECT STATUS']));

// AGC CLIENTS → STATUS never blocks the portal: every contact's link works,
// whatever their status.

// My Account steps → the AGC CLIENTS field that marks each one complete.
// Keys match CONFIG.accountSteps in the portal HTML.
const ACCOUNT_STEPS = {
  account: c => c['Completed Client Form'] === true,
  payment: c => !!c['Payment type'],
  credit:  c => c['Completed Credit App'] === true
};

// PROJECT STATUS values that become client to-dos in "Action Required".
// Keep in step with ACTION_RULES in the portal HTML (used by demo mode).
const ACTION_RULES = [
  { test: /DEPOSIT REQUIRED/i,               label: 'Deposit required',      severity: 'high' },
  { test: /AWAITING APPROVAL/i,              label: 'Approval needed',       severity: 'high' },
  { test: /NEED (REVISED )?PO|AWAITING PO/i, label: 'Purchase order needed', severity: 'normal' },
  { test: /AWAITING RESPONSE/i,              label: 'Response needed',       severity: 'normal' }
];

// Projects hidden from clients:
//   • TEST PROJECT status: always.
//   • NEW PROJECT status: always (AGC hasn't set it up yet).
//   • MASTER PROJECT status: only when it has no retail price (TOTAL COST
//     or RETAIL above 0). A priced master project is shown like any other.
const TEST_STATUS   = /TEST PROJECT/i;
const NEW_STATUS    = /NEW PROJECT/i;
const MASTER_STATUS = /MASTER PROJECT/i;
// Test contacts (AGC CLIENTS record IDs) who see every one of their projects,
// so AGC can try the portal end to end. Test Testerson's Signs & Graphics:
const TEST_CONTACTS = ['reckgKTMZzDhuCFKN'];
const retailOf = rec => {
  const f = rec.fields || {}, n = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
  return n(f['TOTAL COST']) || n(f['RETAIL']);
};
function hiddenFor(client, rec) {
  if (TEST_CONTACTS.includes(client.id)) return false;
  const st = statusName((rec.fields || {})['PROJECT STATUS']);
  if (TEST_STATUS.test(st) || NEW_STATUS.test(st)) return true;
  if (MASTER_STATUS.test(st)) return !(retailOf(rec) > 0);
  return false;
}

// The ONLY project fields that reach a client's browser. Everything else on
// the 425-field table (budgets, profit, installer details, internal notes,
// client passwords…) stays here. Add a field name to show it in the viewer.
const PROJECT_FIELDS = [
  'PROJECT NAME:', 'ID', 'PROJECT STATUS', 'BUDGET TYPE',
  'DATE SCHEDULED:', 'DATE & TIME SCHEDULED', 'DUE DATE:', 'DUE DATE.',
  'STORE NAME(s) & ADDRESS(es)', 'STORE NAME(s)',
  'ADDRESS: (from STORE NAME(s) & ADDRESS(es))', 'LOGO (from STORE NAME(s) & ADDRESS(es))',
  'PROJECT SCOPE:', 'CLIENT UPDATES', 'GRAPHIC LOCATION', 'ONSITE CONTACT',   // CLIENT UPDATES: changes the client emailed (📝 SCOPE UPDATES automation)
  'AGC PROJECT MANAGER:', 'AGC PROJECT MANAGER', 'PM Name', 'PM Direct',
  'LAYOUTS & PLANS', 'DATA SHEET', 'AGC DIRECTIVES:',   // files shown in Files (installer directives included)
  'SHIPPING CO.', 'SHIPPING TO:', 'TRACKING NUMBER', 'DATE SHIPPED', 'Number of PKGS', 'SHIPMENT CONDITION',
  // Pricing & billing (the client's own price, never budgets or profit)
  'DATE ESTIMATED:', 'DATE APPROVED', 'AGC ESTIMATE',
  'PO Received', 'CLIENT PO',
  'DATE INVOICED:', 'DUE:', 'DATE PAID', 'AGC INVOICE', 'DAYS OVERDUE',
  // Finished-work photos
  'INSTALLATION PHOTOS'
];

// Read to build the pricing fields below, but never sent as-is.
//   TOTAL RETAIL = TOTAL COST (PRICE 1–5 + lift) — the client's price (no tax is charged)
//   LINE ITEMS   = PRODUCT / SERVICE n (names) with PRICE n, plus the lift
//   PO NUMBERS   = CLIENT PO NUMBER: (names), CURRENCY / TERMS from the client
const PRICING_SOURCE_FIELDS = [
  'TOTAL COST', 'RETAIL', 'TOTAL LIFT RETAIL', 'CLIENT CURRENCY', 'TERMS', 'TERMS: (from LINKED COMPANY)', 'CLIENT PO NUMBER:',
  'PRODUCT / SERVICE 1', 'PRODUCT / SERVICE 2', 'PRODUCT / SERVICE 3', 'PRODUCT / SERVICE 4', 'PRODUCT / SERVICE 5',
  'PRICE 1', 'PRICE 2', 'PRICE 3', 'PRICE 4', 'PRICE 5'
];
// Projects per request to the viewer (it keeps asking for the next page and
// shows each page as it arrives). Smaller pages stay well inside Wix's time limit.
const VIEWER_PAGE = 20;
const SERVICE_TYPES   = { table: 'tblIA61JoHA5owTg2', field: 'SERVICE TYPE' };   // ⚙️ SERVICE TYPES
const PURCHASE_ORDERS = { table: 'tblYrEFsp6hZR1gOV', field: 'PO NUMBER' };      // 📄 PURCHASE ORDERS
const COMPANY_TERMS   = { table: 'tblINZSYWi3Sbc5Gw', field: 'TERMS:' };         // 💰 A/R (the client's company): payment terms

// Shipping fields a client may change on their OWN projects (AGC fills them
// too; whichever saves last wins). Dropdown values must match Airtable's
// options. Keep in step with SHIPPING_EDITABLE in the portal HTML.
const CLIENT_EDITABLE_FIELDS = {
  'SHIPPING CO.':    v => v === null || ['FEDEX', 'PUROLATOR', 'UPS', 'LOOMIS', 'FREIGHT', 'LOCAL COURIER', 'N/A'].includes(v),
  'SHIPPING TO:':    v => v === null || ['JOB SITE', 'PICKUP FROM DEPOT', 'PICKUP FROM CLIENT', 'LEAD INSTALLERS ADDRESS', 'N/A', 'NOT APPLICABLE'].includes(v),
  'DATE SHIPPED':    v => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  'TRACKING NUMBER': v => typeof v === 'string' && v.length <= 10000,
  'Number of PKGS':  v => v === null || (Number.isInteger(v) && v >= 0 && v <= 999)
};
// Optional: name of a checkbox / date field on AGC PROJECTS to set when a
// client edits shipping, so an Airtable automation can alert the PM.
// Leave '' to skip.
const CLIENT_SHIPPING_FLAG_FIELD = '';
const OWNERSHIP_FIELDS = ['CLIENT', 'RELATED CLIENT CONTACT(s)', 'LINKED COMPANY', 'LINKED COMPANY (from CLIENT)'];   // fetched to check access, never returned
// Master project ↔ sub-project links (both directions are used in Airtable).
// Only the record IDs are sent, as LINKED PROJECT IDS; the viewer groups a
// client's sub-projects under their master using the projects it already has.
const PROJECT_LINK_FIELDS = ['Related Project(s)', 'AGC PROJECTS'];
// Read to work out PROGRESS (below); the installer's own status never reaches the client.
const PROGRESS_SOURCE_FIELDS = ['INSTALLER STATUS'];
// The installer's address is read only to work out their general area (city
// and province) for the "AGC Installer" pin on the map. The street address
// and postal code never leave the backend.
const INSTALLER_SOURCE_FIELDS = ['ADDRESS (from INSTALLER(S)) 2', 'PROVINCE (from INSTALLER(S))'];

const CLIENT_FIELDS = ['NAME', 'BUSINESS', 'EMAIL ADDRESS', 'LOGO', 'LINKED COMPANY', 'Name (from BUSINESS:)', 'STATUS',
                       'Completed Client Form', 'Payment type', 'Completed Credit App'];

// ── Airtable helpers ────────────────────────────────────────────────────────
const AT = 'https://api.airtable.com/v0/';
const qs = (fields) => fields.map(f => 'fields%5B%5D=' + encodeURIComponent(f)).join('&');
const quote = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Wix replaces errors thrown from web methods with a generic message, so the
// web methods below return { error } instead. userError marks messages that
// are safe to show; anything else is turned into a plain explanation.
function userError(msg) { const e = new Error(msg); e.userFacing = true; return e; }
function explain(e) {
  if (e && e.userFacing) return e.message;
  const st = e && e.status;
  console.error('AGC client portal:', st || '', e && e.message);
  if (st === 401 || st === 403) return 'The portal could not sign in to Airtable. Check that the Wix secret "' + AIRTABLE_SECRET_NAME + '" holds a valid Airtable token with access to the AGC base.';
  if (st === 404) return 'The portal could not find the AGC Airtable base or table. Check the token has access to the AGC base.';
  if (st === 422) return 'Airtable rejected the request (' + ((e && e.message) || 'invalid request') + ').';
  if (st === 429) return 'Airtable is busy right now. Please try again in a moment.';
  if (/secret/i.test(String(e && e.message))) return 'The Wix secret "' + AIRTABLE_SECRET_NAME + '" was not found. Check its name in Secrets Manager.';
  return 'Something went wrong loading your portal (' + ((e && e.message) || 'unknown error') + '). Please try again.';
}

// The token, read once every 5 minutes (getSecret is slow).
let _key = null, _keyAt = 0;
async function airtableKey() {
  if (!_key || Date.now() - _keyAt > 300000) { _key = await getSecret(AIRTABLE_SECRET_NAME); _keyAt = Date.now(); }
  return _key;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Airtable allows 5 requests a second per base; a 429 is retried twice.
async function airtable(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await airtableOnce(path, opts); }
    catch (e) { if (e.status !== 429 || attempt >= 2) throw e; await sleep(1200 * (attempt + 1)); }
  }
}
async function airtableOnce(path, { method = 'GET', body, host = AT } = {}) {
  const key = await airtableKey();
  const res = await fetch(host + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json.error && (json.error.message || json.error.type)) || ('Airtable error ' + res.status);
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return json;
}

// ── Sign-in (no Wix login) ──────────────────────────────────────────────────
// Like the Mimuro ambassador portal: each contact's personal link
//   https://www.americangraphiccontractors.com/client-portal?client=<record id>
// (AGC CLIENTS → CLIENT PORTAL URL) says who they are, so the login screen
// greets them by name and asks only for their password. Without the link
// they sign in with email + password.
//   • First visit (PASSWORD empty): from their personal link they confirm the
//     EMAIL ADDRESS shown on screen and create a password, saved to PASSWORD.
//   • Forgotten password: the request lands in PORTAL UPDATES; AGC clears
//     PASSWORD and the client creates a new one from their link.
//   • The page code keeps the session in memory only, so a refresh or a new
//     visit asks for the password again. A session can last at most
//     SESSION_DAYS even if the page stays open. Changing PASSWORD in Airtable
//     signs that contact out everywhere.
//   • Optional staff access: store a secret named STAFF_SECRET_NAME in Wix;
//     typing it as the password on any client's link opens their portal.
const SESSION_DAYS = 1;
const MIN_PASSWORD = 8;
const PASSWORD_FIELD = 'PASSWORD';
const STAFF_SECRET_NAME = 'AGCClientPortalStaff';   // optional
const MAX_FAILS = 8, FAIL_WINDOW_MS = 15 * 60 * 1000;

const isRecId = v => /^rec[A-Za-z0-9]{14}$/.test(String(v || ''));
const normEmail = v => String(v || '').trim().toLowerCase();
const blocked = () => false;   // no status blocks portal access
const pwOf = rec => String(rec.fields[PASSWORD_FIELD] || '').trim();

let _signKey = null;
async function signKey() {
  if (!_signKey) _signKey = crypto.createHash('sha256').update('agc-client-portal-session|' + await getSecret(AIRTABLE_SECRET_NAME)).digest();
  return _signKey;
}
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const fingerprint = pw => crypto.createHash('sha256').update('pw|' + String(pw || '')).digest('hex').slice(0, 16);
function sameText(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
async function makeToken(clientId, fp) {
  const body = b64u(JSON.stringify({ c: clientId, x: Date.now() + SESSION_DAYS * 864e5, f: fp }));
  return body + '.' + b64u(crypto.createHmac('sha256', await signKey()).update(body).digest());
}
async function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = b64u(crypto.createHmac('sha256', await signKey()).update(body).digest());
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const d = JSON.parse(unb64u(body).toString('utf8')); return d && isRecId(d.c) && d.x > Date.now() ? d : null; } catch (e) { return null; }
}
async function staffPassword() { try { return String(await getSecret(STAFF_SECRET_NAME) || '').trim(); } catch (e) { return ''; } }

// Failed-attempt limit (per email / per link), best effort.
const fails = new Map();
function locked(key) { const f = fails.get(key); return !!f && f.n >= MAX_FAILS && Date.now() - f.at < FAIL_WINDOW_MS; }
function failed(key) { const f = fails.get(key); const fresh = !f || Date.now() - f.at > FAIL_WINDOW_MS; fails.set(key, { n: fresh ? 1 : f.n + 1, at: fresh ? Date.now() : f.at }); }

const clientById = new Map();   // recId → { rec, at }
async function getClientRecord(id, fresh) {
  const hit = clientById.get(id);
  if (!fresh && hit && Date.now() - hit.at < 60000) return hit.rec;
  let rec = null;
  try { rec = await airtable(`${BASE}/${CLIENTS}/${id}`); } catch (e) { if (e.status !== 404) throw e; }
  if (rec) clientById.set(id, { rec, at: Date.now() });
  return rec;
}
async function clientsByEmail(email) {
  const formula = `LOWER(TRIM({EMAIL ADDRESS}))="${quote(email)}"`;
  const res = await airtable(`${BASE}/${CLIENTS}?maxRecords=10&${qs(CLIENT_FIELDS.concat([PASSWORD_FIELD]))}&filterByFormula=${encodeURIComponent(formula)}`);
  return (res.records || []).filter(r => !blocked(r));
}
function authError(msg) { const e = userError(msg || 'Please sign in.'); e.auth = true; return e; }

// The signed-in contact for a session token (throws authError if not valid).
async function sessionClient(token) {
  const d = await readToken(token);
  if (!d) throw authError('Your session has ended. Please sign in again.');
  const rec = await getClientRecord(d.c);
  if (!rec || blocked(rec)) throw authError('This account is no longer active. Please contact AGC.');
  const fp = String(d.f || '').startsWith('staff:') ? 'staff:' + fingerprint(await staffPassword()) : fingerprint(pwOf(rec));
  if (d.f !== fp || fp === 'staff:' + fingerprint('')) throw authError('Your password changed. Please sign in again.');
  rec.__staff = String(d.f).startsWith('staff:');
  return rec;
}
function initData(rec) {
  const out = { clientId: rec.id, firstName: firstName(rec), company: companyName(rec), logoUrl: logoUrl(rec) };
  if (rec.__staff) out.notice = 'AGC staff access: you are viewing ' + (companyName(rec) || 'this client') + (firstName(rec) ? ' (' + firstName(rec) + ')' : '') + "'s portal.";
  return out;
}
function maskEmail(e) {
  const [u, d] = String(e || '').split('@'); if (!d) return '';
  return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.min(6, u.length - 2))) + '@' + d;
}

// BUSINESS holds "ICON Digital Productions Inc. - Jian"; the clean company
// name is the LINKED COMPANY lookup ("ICON Digital Productions Inc.").
function lookupText(v) {
  if (Array.isArray(v)) return String(v.find(Boolean) || '').trim();
  if (v && typeof v === 'object' && v.valuesByLinkedRecordId) {
    const all = [].concat(...Object.values(v.valuesByLinkedRecordId)); return String(all.find(Boolean) || '').trim();
  }
  return String(v || '').trim();
}
function companyName(c) {
  return lookupText(c.fields['Name (from BUSINESS:)']) ||
         String(c.fields.BUSINESS || '').replace(/\s+-\s+[^-]*$/, '').trim();
}
function firstName(c) { return String(c.fields.NAME || '').trim(); }

function logoUrl(c) {
  const a = (c.fields.LOGO || [])[0];
  return a ? ((a.thumbnails && a.thumbnails.large && a.thumbnails.large.url) || a.url) : '';
}

// ── Projects (scoped to the client, fields allowlisted) ─────────────────────
function belongsToClient(rec, client) {
  const f = rec.fields || {};
  const ids = v => (Array.isArray(v) ? v : []).map(x => (x && typeof x === 'object') ? x.id : x);
  if (ids(f.CLIENT).includes(client.id) || ids(f['RELATED CLIENT CONTACT(s)']).includes(client.id)) return true;
  if (SHARE_ACROSS_COMPANY) {
    const mine = ids(client.fields['LINKED COMPANY']);
    if (!mine.length) return false;
    return ids(f['LINKED COMPANY']).concat(ids(f['LINKED COMPANY (from CLIENT)'])).some(id => mine.includes(id));
  }
  return false;
}

// Names for linked records (service types, PO numbers), cached 10 minutes.
const nameCache = new Map();   // recId → { name, at }
// SERVICE TYPES is small (~230 rows): read the whole table, 10-minute cache.
let _svcAt = 0, _svcLoading = null;
async function loadServiceTypes() {
  if (Date.now() - _svcAt < 600000) return;
  if (!_svcLoading) _svcLoading = (async () => {
    let offset = null, guard = 0;
    do {
      const res = await airtable(`${BASE}/${SERVICE_TYPES.table}?pageSize=100&${qs([SERVICE_TYPES.field])}` + (offset ? `&offset=${encodeURIComponent(offset)}` : ''));
      (res.records || []).forEach(r => nameCache.set(r.id, { name: String(r.fields[SERVICE_TYPES.field] || '').trim(), at: Date.now() }));
      offset = res.offset || null;
    } while (offset && ++guard < 20);
    _svcAt = Date.now();
  })().catch(() => {}).finally(() => { _svcLoading = null; });
  return _svcLoading;
}
async function resolveNames(spec, ids) {
  if (spec === SERVICE_TYPES) return loadServiceTypes();
  const need = [...new Set(ids)].filter(id => { const h = nameCache.get(id); return !h || Date.now() - h.at > 600000; });
  for (let i = 0; i < need.length; i += 90) {
    const chunk = need.slice(i, i + 90);
    const formula = `OR(${chunk.map(id => `RECORD_ID()="${id}"`).join(',')})`;
    try {
      const res = await airtable(`${BASE}/${spec.table}?${qs([spec.field])}&filterByFormula=${encodeURIComponent(formula)}`);
      (res.records || []).forEach(r => nameCache.set(r.id, { name: String(r.fields[spec.field] || '').trim(), at: Date.now() }));
    } catch (e) { /* names are a nicety; prices still show */ }
  }
}
const linkIds = v => (Array.isArray(v) ? v : []).map(x => (x && typeof x === 'object') ? x.id : x).filter(Boolean);
const nameOf  = id => (nameCache.get(id) || {}).name || '';
const firstText = v => Array.isArray(v) ? statusName(v.find(Boolean)) : statusName(v);
async function shapeAll(records) {
  const svc = [], po = [], co = [];
  records.forEach(r => {
    const f = r.fields || {};
    for (let n = 1; n <= 5; n++) svc.push(...linkIds(f['PRODUCT / SERVICE ' + n]));
    po.push(...linkIds(f['CLIENT PO NUMBER:']));
    if (!firstText(f['TERMS: (from LINKED COMPANY)']) && !firstText(f['TERMS'])) co.push(...companyIds(f));   // terms from the client's company
  });
  const areas = [...new Set(records.map(r => firstText((r.fields || {})['ADDRESS (from INSTALLER(S)) 2'])).filter(Boolean))].slice(0, 25);
  await Promise.all([svc.length && resolveNames(SERVICE_TYPES, svc), po.length && resolveNames(PURCHASE_ORDERS, po),
                     co.length && resolveNames(COMPANY_TERMS, co),
                     Promise.all(areas.map(a => { const r = records.find(x => firstText((x.fields || {})['ADDRESS (from INSTALLER(S)) 2']) === a);
                       return installerGeoQuick(a, firstText((r.fields || {})['PROVINCE (from INSTALLER(S))'])); }))]);
  return records.map(shapeProject);
}

function shapeProject(rec) {
  const src = rec.fields || {}, out = {};
  PROJECT_FIELDS.forEach(k => { if (src[k] !== undefined) out[k] = src[k]; });
  // Pricing, built from the source fields above.
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const lines = [];
  for (let n = 1; n <= 5; n++) {
    const price = num(src['PRICE ' + n]);
    const names = linkIds(src['PRODUCT / SERVICE ' + n]).map(nameOf).filter(Boolean);
    if (price !== null || names.length) lines.push({ item: names.join(', ') || ('Item ' + n), price });
  }
  const lift = num(src['TOTAL LIFT RETAIL']);
  if (lift) lines.push({ item: 'Lift / equipment rental', price: lift });
  if (lines.length) out['LINE ITEMS'] = lines;
  const total = num(src['TOTAL COST']) ?? num(src['RETAIL']);
  if (total !== null) out['TOTAL RETAIL'] = total;
  const cur = firstText(src['CLIENT CURRENCY']); if (cur) out['CURRENCY'] = cur;
  // Payment terms: the project's company, else the client contact's, else the
  // client's company. Airtable's DUE: / DAYS OVERDUE only use the first, so
  // they're worked out here when they're blank.
  const terms = termsLabel(firstText(src['TERMS: (from LINKED COMPANY)']) || firstText(src['TERMS']) ||
                           companyIds(src).map(nameOf).find(Boolean) || '');
  if (terms) {
    out['TERMS'] = terms;
    const days = termsDays(terms), inv = String(src['DATE INVOICED:'] || '').slice(0, 10);
    if (days !== null && /^\d{4}-\d{2}-\d{2}$/.test(inv)) {
      const due = src['DUE:'] ? String(src['DUE:']).slice(0, 10) : addDays(inv, days);
      out['DUE:'] = due;
      if (typeof src['DAYS OVERDUE'] !== 'number' && !src['DATE PAID']) {
        const over = dayDiff(due, todayInToronto());
        if (over > 0) out['DAYS OVERDUE'] = over; else delete out['DAYS OVERDUE'];
      }
    }
  }
  const pos = linkIds(src['CLIENT PO NUMBER:']).map(nameOf).filter(Boolean); if (pos.length) out['PO NUMBERS'] = pos;
  // Installer pin: the town for the label (never the street address), the
  // geocoded address for where the pin goes.
  const instAddr = firstText(src['ADDRESS (from INSTALLER(S)) 2']);
  const geo = geoCache.get(String(instAddr || '').trim().toLowerCase());
  const area = (geo && geo.area) || installerAreaText(instAddr, firstText(src['PROVINCE (from INSTALLER(S))']));
  if (area) out['INSTALLER AREA'] = area;
  if (geo && geo.lnglat) out['INSTALLER LNGLAT'] = geo.lnglat;
  // Install progress in plain words (used for subprojects).
  out['PROGRESS'] = progressOf(src);
  // Linked projects (master ↔ sub-projects): IDs only.
  const linked = [...new Set(PROJECT_LINK_FIELDS.flatMap(k => linkIds(src[k])))].filter(id => id !== rec.id);
  if (linked.length) out['LINKED PROJECT IDS'] = linked;
  // The viewer reads INSTALLER STATUS for its status pills; clients get the
  // PROJECT STATUS instead.
  out['INSTALLER STATUS'] = src['PROJECT STATUS'] || '';
  // No install date until the project is actually scheduled.
  if (notScheduledYet(src)) { delete out['DATE SCHEDULED:']; delete out['DATE & TIME SCHEDULED']; }
  // Store names arrive pre-resolved so the viewer never queries other tables.
  if (src['STORE NAME(s)']) out['NAME (from STORE NAME(s) & ADDRESS(es))'] = src['STORE NAME(s)'];
  return { id: rec.id, createdTime: rec.createdTime, fields: out };
}

// ── Install progress ────────────────────────────────────────────────────────
// A simple status for clients, from INSTALLER STATUS (plus the install date
// and the project status where the installer status is out of date):
//   TBD · CONFIRMED · SCHEDULED · IN PROGRESS · AWAITING PHOTOS · ISSUES · COMPLETE
const PROGRESS_RANK = { 'TBD': 0, 'CONFIRMED': 1, 'SCHEDULED': 2, 'IN PROGRESS': 3, 'AWAITING PHOTOS': 4, 'COMPLETE': 5 };
function todayInToronto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function progressOf(src) {
  const inst = statusName(src['INSTALLER STATUS']).toUpperCase();
  const proj = statusName(src['PROJECT STATUS']).toUpperCase();
  const date = String(src['DATE SCHEDULED:'] || '').slice(0, 10);
  let s;
  if (/ISSUE/.test(inst)) s = 'ISSUES';
  else if (/PHOTOS/.test(inst)) s = 'AWAITING PHOTOS';                            // need completion / new photos
  else if (/INVOICE|PAID|NO CHARGE/.test(inst)) s = 'COMPLETE';                   // installer has finished
  else if (/WORK IN PROGRESS/.test(inst)) s = 'IN PROGRESS';
  else if (/CONFIRMED/.test(inst)) s = !date ? 'CONFIRMED' : (date > todayInToronto() ? 'SCHEDULED' : 'IN PROGRESS');
  else s = 'TBD';                                                                 // TBD, upcoming, quotes, need confirmation
  if (s === 'ISSUES' || /CHALLANGE|CHALLENGE/.test(proj)) return 'ISSUES';
  const below = t => PROGRESS_RANK[s] < PROGRESS_RANK[t];
  if (/PROJECT COMPLETE|INVOICE SENT|INVOICE PAID|COMPLETE AWAITING PO|PENDING CHARGES|AWAI?TI?NG FINAL COSTS/.test(proj) && below('AWAITING PHOTOS')) return 'COMPLETE';
  if (/MISSING PHOTOS/.test(proj) && below('AWAITING PHOTOS')) return 'AWAITING PHOTOS';
  if (/IN PROGRESS/.test(proj) && below('IN PROGRESS')) return 'IN PROGRESS';
  return s;
}

// Payment terms ("C.O.D.", "30 DAYS", "45 days" …) → "C.O.D." / "30 days".
function termsLabel(t) {
  t = String(t || '').trim();
  if (/C\.?\s*O\.?\s*D/i.test(t)) return 'C.O.D.';
  const n = /(\d+)/.exec(t); return n ? n[1] + ' days' : t;
}
function termsDays(t) {
  if (/C\.?\s*O\.?\s*D/i.test(t)) return 0;
  const n = /(\d+)/.exec(String(t || '')); return n ? +n[1] : null;
}
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dayDiff(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
const companyIds = f => linkIds(f['LINKED COMPANY']).concat(linkIds(f['LINKED COMPANY (from CLIENT)']));

// Installer's general area, worked out from their address in the backend.
// Mapbox finds the town (cached); if that isn't available, the address text
// is read: "123 Main St, Calgary, AB T2X 1A1" / "4665 Lobsinger Line
// Millbank ON N0K 1L0, Canada - NSR" → "Calgary, AB" / "Millbank, ON".
const MAPBOX_TOKEN = '__MAPBOX_TOKEN__';   // the portal's public map token
const PROV_NAMES = { 'ALBERTA': 'AB', 'BRITISH COLUMBIA': 'BC', 'MANITOBA': 'MB', 'NEW BRUNSWICK': 'NB', 'NEWFOUNDLAND AND LABRADOR': 'NL', 'NEWFOUNDLAND': 'NL',
  'NOVA SCOTIA': 'NS', 'NORTHWEST TERRITORIES': 'NT', 'NUNAVUT': 'NU', 'ONTARIO': 'ON', 'PRINCE EDWARD ISLAND': 'PE', 'QUEBEC': 'QC', 'QUÉBEC': 'QC', 'SASKATCHEWAN': 'SK', 'YUKON': 'YT' };
const PROV_CODES = /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/;
const STREET_WORDS = /^(st|street|rd|road|ave|avenue|av|blvd|boulevard|boul|dr|drive|ln|lane|line|way|cres|crescent|ct|court|cir|circle|hwy|highway|pkwy|parkway|pl|place|sq|square|terr|terrace|trail|tr|gate|concession|conc|sideroad|row|close|cove|grove|green|heights|hts|hill|mews|path|ridge|run|view|walk|rang|rue|chemin|ch|route|rte|loop|bay|unit|suite|ste|apt|po|box|street,|town)$/i;
// Province / state names and codes (with common misspellings) → code
const REGIONS = Object.assign({}, PROV_NAMES, {
  'NEWFOUNDLAND & LABRADOR': 'NL', 'PEI': 'PE', 'P.E.I.': 'PE', 'ONTARIA': 'ON', 'ONTRAIO': 'ON', 'ONTATIO': 'ON', 'MANITIBA': 'MB', 'SASKATCHEWEN': 'SK', 'ALBERA': 'AB', 'ABERTA': 'AB', 'ALBRETA': 'AB', 'BRITISH COLOMBIA': 'BC', 'ONTARO': 'ON', 'ONATRIO': 'ON', 'QUEBC': 'QC', 'QUBEC': 'QC',
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI',
  'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI',
  'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
  'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
});
function provCode(p) {
  p = String(p || '').trim().toUpperCase().replace(/[().]/g, '').replace(/\s+/g, ' ');
  if (REGIONS[p]) return REGIONS[p];
  if (PROV_CODES.test(p)) return p;
  if (p === 'BC' || p === 'B C') return 'BC';
  return '';
}
const FR_STREET = /^(rue|chemin|ch|boul|boulevard|route|rte|rang|montée|montee|place|av|avenue|allée|allee|impasse|côte|cote)$/i;
const UNIT_WORDS = /^(unit|suite|ste|apt|bay|bldg|building|local|bureau|#)$/i;
const DIR_ABBR = /^(n|s|e|w|ne|nw|se|sw|n\.|s\.|e\.|w\.)$/i;
// The town in one comma piece of an address: "1210 Main St W North Bay" → "North Bay",
// "#14 Campbell River" → "Campbell River", "128 rue St-Joseph Valleyfield" → "Valleyfield", "Terrace" → "Terrace".
function townFromPiece(piece) {
  piece = piece.map(w => w.replace(/^[(\[]+|[)\]]+$/g, '')).filter(w => w && !/^[-–.]$/.test(w));
  if (!piece.length) return '';
  let d = -1; piece.forEach((w, n) => { if (/\d/.test(w) || /^#/.test(w)) d = n; });
  let rest = piece;
  if (d >= 0) {
    rest = piece.slice(d + 1);
    const clean = w => String(w || '').replace(/[.,]+$/, '');
    const unit = /^#/.test(piece[d]) || /^[A-Z]\d+$|^\d+[A-Z]$/i.test(piece[d]) && d > 0 ||
      [1, 2].some(b => d - b >= 0 && UNIT_WORDS.test(clean(piece[d - b]))) || (/^\d+[A-Z]?$/i.test(piece[d]) && d > 0 && STREET_WORDS.test(clean(piece[d - 1])));
    // a numbered street ("50th Street", "2612 109 St") can have its suffix right after the number
    const numberedStreet = /^\d+(st|nd|rd|th|e|er|ème|a)?$/i.test(piece[d]) && (/^\d+(st|nd|rd|th|e|er|ème)$/i.test(piece[d]) || (d > 0 && /\d/.test(piece[d - 1])));
    if (!rest.length) return '';
    if (FR_STREET.test(clean(rest[0])) && rest.length > 2) rest = rest.slice(2);   // "rue St-Joseph Valleyfield"
    else {
      let st = -1;
      for (let n = numberedStreet ? 0 : 1; n < rest.length; n++) if (STREET_WORDS.test(clean(rest[n]))) { st = n; break; }
      if (st >= 0) rest = rest.slice(st + 1);
      else if (!unit) return '';                                       // "123 Something Town": can't tell the street from the town
    }
    while (rest.length && DIR_ABBR.test(rest[0])) rest = rest.slice(1);
  }
  for (let n = rest.length - 2; n >= 0; n--) if (/^[A-Z]{2}$/.test(rest[n]) && provCode(rest[n])) { rest = rest.slice(n + 1); break; }   // "Surrey BC Surrey"
  const city = rest.join(' ').replace(/^[\s.,#\-–]+|[\s.,#\-–?!]+$/g, '').replace(/\s{2,}/g, ' ');
  if (!city || /\d/.test(city) || city.split(' ').length > 4 || !/^[A-Za-zÀ-ÿ'’.\- ]+$/.test(city)) return '';
  if (/^(box|po|p o|unit|suite|area|areas|surrounding|and|the)$/i.test(city) || /\b(surrounding|areas?|webpage|referred|found|online)\b/i.test(city)) return '';
  return city;
}
// "123 Main St, Calgary, AB T2X 1A1" / "4665 Lobsinger Line Millbank ON N0K 1L0, Canada - NSR" /
// "5133 Tomken Rd, Mississauga, OntarioL4W 1P1, Canada" / "2033 Varsity Dr #14 Campbell River, British Columbia"
// → "Calgary, AB" / "Millbank, ON" / "Mississauga, ON" / "Campbell River, BC". Unreadable → ''.
function installerAreaText(addr, prov) {
  const fallbackRegion = provCode(prov);
  const lines = String(addr || '').split(/\n+/).map(l => l.replace(/^\s*(shipping|office|mailing|address)\s*:\s*/i, '').trim())
    .filter(l => l && /[a-z]{3}/i.test(l) && !/^[🔴\W]*ey[A-Za-z0-9+/=]{20,}/.test(l) && !/^(attn|\(found|c\/o)\b/i.test(l));
  let firstCity = '';
  for (const line of lines) {
    let t = ' ' + line + ' ';
    t = t.replace(/\b(St|Dr|Rd|Ave|Way|Blvd|Cres|Ct|Ln|Pl|Hwy)([A-Z][a-z]{2,})/g, '$1 $2')   // "Mosasco StBakersfield", "Adi Dassler WayParis"
         .replace(/([a-z]{3,})\.+(?=[A-Z])/g, '$1. ')                                     // "Boulevard.Je-Me-Souviens"
         .replace(/[A-Z]\d[A-Z]\s*-?\s*\d[A-Z]\d/gi, ' , ')               // Canadian postal codes, even glued on ("OntarioL4W 1P1")
         .replace(/\b[A-Z]\d[A-Z]\b(?=\s*,|\s*$|\s+canad)/gi, ' , ')     // partial postal code ("T1L")
         .replace(/\b\d{5}(-\d{4})?\b(?=\s*(,|$|(usa|us|united)\b))/gi, ' , ')   // US ZIP (not a 5-digit house number)
         .replace(/(^|[^-\w])(canad[a-zá�]*|u\.?s\.?a\.?|united states)(?![-\w]).*$/i, '$1 ')
         .replace(/\bno\.?\s*\d+\b/gi, ' ')   // country and anything after it
         .replace(/\(\s*(on|qc|bc|ab|mb|sk|ns|nb|nl|pe)\s*\)/gi, ' ')       // "Ontario (ON)"
         .replace(/\s+-\s+/g, ' , ');
    // find the last province / state mention
    const words = t.split(/(\s+|,)/).filter(w => w && w.trim());
    let pIdx = -1, region = '';
    for (let n = 0; n < words.length; n++) {
      for (let len = 3; len >= 1; len--) {
        if (n + len > words.length) continue;
        const chunk = words.slice(n, n + len).filter(w => w !== ',').join(' ');
        const code = provCode(chunk);
        if (code && (len > 1 || chunk.replace(/[^A-Za-z]/g, '').length >= 2)) {
          // two-letter codes only count as a province when they stand alone (not "St", "Dr" …)
          if (len === 1 && /^[A-Za-z.]{2,3}$/.test(chunk) && !/^[A-Z.]{2,4}$/.test(chunk)) continue;
          pIdx = n; region = code; break;
        }
      }
    }
    const before = pIdx >= 0 ? words.slice(0, pIdx) : words;
    // comma pieces before the province, last first: the town is the last piece that has one
    const pieces = [[]]; before.forEach(w => { if (w === ',') pieces.push([]); else pieces[pieces.length - 1].push(w); });
    for (let pi = pieces.length - 1; pi >= 0; pi--) {
      const city = townFromPiece(pieces[pi]);
      if (city) {
        const nice = city.replace(/(^|[\s\-])([a-zà-ÿ])([a-zà-ÿ'’]*)/gi, (m, sp, a, b) => sp + a.toUpperCase() + b.toLowerCase())
          .replace(/\b(De|Du|Des|La|Le|Les|Sur|En|Of|And)\b(?=[\s\-]\S)/g, (m, w, o) => o === 0 ? w : w.toLowerCase())
          .replace(/\bSt(?= )/g, 'St.').replace(/\bSte(?= )/g, 'Ste.');
        if (region) return nice + ', ' + region;          // a line with a province / state wins
        if (!firstCity) firstCity = nice + (fallbackRegion ? ', ' + fallbackRegion : '');
        break;
      }
      if (pieces[pi].some(w => /\d/.test(w))) break;   // a street piece: anything before it is the street too
    }
  }
  return firstCity;
}
// ── Installer pin: the installer's address geocoded on the server, checked
// against the town / province / postal code written in the address so a
// look-alike street in another town (e.g. "Main St W" → Pinewood instead of
// North Bay) is never used. Result: { area: 'North Bay, ON', lnglat: [lng, lat] }.
const geoCache = new Map();
const normName = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\bsaint(e?)\b/g, 'st$1').replace(/\b(twp|township|city|town|village|municipality|county|of)\b/g, '').replace(/[^a-z]/g, '');
function sameTown(a, b) { a = normName(a); b = normName(b); return !!a && !!b && (a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)))); }
function addrPostal(addr) {
  const ca = String(addr || '').match(/\b([A-Z]\d[A-Z])\s*-?\s*(\d[A-Z]\d)\b/i) || String(addr || '').match(/([A-Z]\d[A-Z])\s*(\d[A-Z]\d)\b/i);
  if (ca) return (ca[1] + ' ' + ca[2]).toUpperCase();
  const us = String(addr || '').match(/\b[A-Z]{2},?\s+(\d{5})(-\d{4})?\b/);
  return us ? us[1] : '';
}
// The line of the address with the street in it, tidied for the geocoder.
function addrForGeocode(addr) {
  const lines = String(addr || '').split(/\n+/).map(l => l.replace(/^\s*(shipping|office|mailing|address)\s*:\s*/i, '').replace(/\((shipping|office|mailing)[^)]*\)/ig, '').trim())
    .filter(l => l && /[a-z]{3}/i.test(l) && !/^[🔴\W]*ey[A-Za-z0-9+/=]{20,}/.test(l) && !/^(attn|\(found|c\/o)\b/i.test(l));
  const line = lines.find(l => /\d/.test(l) && (addrPostal(l) || /,/.test(l))) || lines[0] || '';
  return line.replace(/\s*-\s*NSR\b/i, '').replace(/\s*-?\s*attn:.*$/i, '')
    .replace(/([a-z])([A-Z]\d[A-Z]\s*\d[A-Z]\d)/g, '$1 $2')                         // "OntarioL4W 1P1"
    .replace(/\b(St|Dr|Rd|Ave|Way|Blvd|Cres|Ct|Ln|Pl|Hwy)([A-Z][a-z]{2,})/g, '$1 $2')
    .replace(/\s{2,}/g, ' ').trim();
}
async function mbFeatures(q, types, limit) {
  if (!q) return [];
  const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(q) + '.json?access_token=' + MAPBOX_TOKEN +
              '&limit=' + (limit || 5) + '&country=CA,US&language=en&autocomplete=false&types=' + types;
  try {
    const res = await Promise.race([fetch(url), sleep(2500).then(() => null)]);
    const j = res && res.ok ? await res.json() : null;
    return (j && j.features) || [];
  } catch (e) { return []; }
}
function featParts(ft) {
  const ctx = [ft].concat(ft.context || []);
  const kind = c => String(c.id || '').split('.')[0];
  const towns = ctx.filter(c => /^(place|locality|district|neighborhood)$/.test(kind(c))).map(c => c.text);
  const reg = ctx.find(c => kind(c) === 'region');
  const pc = ctx.find(c => kind(c) === 'postcode');
  const place = ctx.find(c => kind(c) === 'place') || ctx.find(c => kind(c) === 'locality');
  return { towns, place: place && place.text, region: reg && reg.short_code ? String(reg.short_code).split('-').pop().toUpperCase() : '', postal: pc ? pc.text : '' };
}
async function installerGeo(addr, prov) {
  const key = String(addr || '').trim().toLowerCase(); if (!key) return { area: '', lnglat: null };
  if (geoCache.has(key)) return geoCache.get(key);
  const area = installerAreaText(addr, prov);
  const town = area ? area.split(',')[0].trim() : '';
  const region = (area.split(', ')[1] || provCode(prov) || '').trim();
  const postal = addrPostal(addr);
  const regionOk = p => !region || !p.region || p.region === region;
  const postalOk = p => !!postal && !!p.postal && p.postal.replace(/\s/g, '').toUpperCase().slice(0, 3) === postal.replace(/\s/g, '').slice(0, 3);
  const townOk = p => !!town && p.towns.some(t => sameTown(t, town));
  let hit = null, how = '';
  // 1. the street address itself: must be in the right province AND the right town or postal area
  const q = addrForGeocode(addr);
  if (q && /\d/.test(q)) {
    const feats = await mbFeatures(q, 'address', 5);
    hit = feats.find(ft => { const p = featParts(ft); return regionOk(p) && (townOk(p) || postalOk(p)) && (town || postal); });
    if (hit) how = 'address';
  }
  // 2. the postal code (a few blocks in Canada)
  if (!hit && postal) {
    const feats = await mbFeatures(postal, 'postcode', 3);
    hit = feats.find(ft => regionOk(featParts(ft)) && (!town || townOk(featParts(ft)) || /^[A-Z]\d[A-Z]/.test(postal)));
    if (hit) how = 'postcode';
  }
  // 3. the town
  if (!hit && town) {
    const feats = await mbFeatures(town + (region ? ', ' + region : ''), 'place,locality', 3);
    hit = feats.find(ft => { const p = featParts(ft); return regionOk(p) && townOk(p); });
    if (hit) how = 'town';
  }
  let outArea = area;
  if (!outArea && hit) { const p = featParts(hit); if (p.place && regionOk(p)) outArea = p.place + (p.region ? ', ' + p.region : ''); }
  const out = { area: outArea, lnglat: hit && Array.isArray(hit.center) ? [+hit.center[0], +hit.center[1]] : null, how };
  geoCache.set(key, out);
  return out;
}
// Text-only answer right away when the geocoder is slow; the lookup keeps going and fills the cache.
function installerGeoQuick(addr, prov, ms) {
  return Promise.race([installerGeo(addr, prov), sleep(ms || 4000).then(() => ({ area: installerAreaText(addr, prov), lnglat: null }))]);
}

function statusName(v) { return (v && typeof v === 'object' && v.name) ? v.name : String(v || ''); }

// Newest records first (ID is an autonumber), so the first projects the client sees are the latest.
const NEWEST_FIRST = '&' + encodeURIComponent('sort[0][field]') + '=ID&' + encodeURIComponent('sort[0][direction]') + '=desc';

// One page of the client's projects. Airtable pre-filters by name (link
// fields compare by display text in formulas); the record-ID check below is
// what actually grants access.
async function listClientProjects(client, offset) {
  // Linked records compare by their display name (AGC CLIENTS → BUSINESS).
  const formula = clientFormula(client);
  const path = `${BASE}/${PROJECTS}?pageSize=${VIEWER_PAGE}&${qs(PROJECT_FIELDS.concat(PRICING_SOURCE_FIELDS, OWNERSHIP_FIELDS, PROJECT_LINK_FIELDS, PROGRESS_SOURCE_FIELDS, INSTALLER_SOURCE_FIELDS))}` +
               `&filterByFormula=${encodeURIComponent(formula)}` + NEWEST_FIRST + (offset ? `&offset=${encodeURIComponent(offset)}` : '');
  const res = await airtable(path);
  const records = (res.records || [])
    .filter(r => belongsToClient(r, client))
    .filter(r => !hiddenFor(client, r));
  return { records: await shapeAll(records), offset: res.offset || null };
}
function clientFormula(client) {
  const n = quote(String(client.fields.BUSINESS || '').trim());
  if (!n) return 'FALSE()';
  const clauses = [`FIND("${n}", ARRAYJOIN({CLIENT}))`, `FIND("${n}", ARRAYJOIN({RELATED CLIENT CONTACT(s)}))`];
  const co = companyName(client);
  if (SHARE_ACROSS_COMPANY && co) clauses.push(`FIND("${quote(co)}", ARRAYJOIN({LINKED COMPANY (from CLIENT)}))`, `FIND("${quote(co)}", ARRAYJOIN({LINKED COMPANY}))`);
  return `OR(${clauses.join(',')})`;
}

// The dashboard only needs a few fields per project, so it reads a light
// list (no prices or names), stopping before Wix's ~14 s backend limit.
const DASHBOARD_FIELDS = ['PROJECT NAME:', 'ID', 'PROJECT STATUS', 'DATE SCHEDULED:', 'DATE & TIME SCHEDULED',
                          'ADDRESS: (from STORE NAME(s) & ADDRESS(es))', 'TOTAL COST', 'RETAIL'];
async function dashboardProjects(client) {
  const out = []; let offset = null, guard = 0; const t0 = Date.now();
  const base = `${BASE}/${PROJECTS}?pageSize=100&${qs(DASHBOARD_FIELDS.concat(OWNERSHIP_FIELDS))}&filterByFormula=${encodeURIComponent(clientFormula(client))}`;
  do {
    const res = await airtable(base + (offset ? `&offset=${encodeURIComponent(offset)}` : ''));
    (res.records || []).forEach(r => {
      if (belongsToClient(r, client) && !hiddenFor(client, r)) out.push(r);
    });
    offset = res.offset || null;
  } while (offset && ++guard < 50 && Date.now() - t0 < 10000);
  return out;
}

// ── Projects viewer proxy ───────────────────────────────────────────────────
// My Projects thinks it's talking to Airtable. Answered: reads of the
// client's projects, and shipping edits on one of them. Everything else is
// refused.
const DENY = { status: 403, body: { error: { type: 'FORBIDDEN', message: 'Not available in the client portal.' } } };
async function proxy(client, { method, url, body } = {}) {
  const m = /^https:\/\/api\.airtable\.com\/v0\/([^/]+)\/([^/?]+)(?:\/(rec[A-Za-z0-9]+))?(?:\?(.*))?$/.exec(String(url || ''));
  const verb = String(method || 'GET').toUpperCase();
  if (!m || m[1] !== BASE || m[2] !== PROJECTS) return DENY;
  if (verb === 'PATCH' && m[3]) return updateShipping(client, m[3], body);
  if (verb !== 'GET') return DENY;
  try {
    if (m[3]) {
      const rec = await airtable(`${BASE}/${PROJECTS}/${m[3]}`);
      if (!belongsToClient(rec, client) || hiddenFor(client, rec))
        return { status: 404, body: { error: { type: 'NOT_FOUND' } } };
      return { status: 200, body: (await shapeAll([rec]))[0] };
    }
    const offset = new URLSearchParams(m[4] || '').get('offset');
    const page = await listClientProjects(client, offset);
    return { status: 200, body: page.offset ? { records: page.records, offset: page.offset } : { records: page.records } };
  } catch (e) {
    return { status: e.status || 502, body: { error: { type: 'UPSTREAM', message: e.message } } };
  }
}

async function updateShipping(client, recordId, rawBody) {
  let fields;
  try { fields = (JSON.parse(rawBody || '{}') || {}).fields; } catch (e) { fields = null; }
  if (!fields || typeof fields !== 'object' || !Object.keys(fields).length)
    return { status: 422, body: { error: { type: 'INVALID', message: 'Nothing to save.' } } };
  for (const [k, v] of Object.entries(fields)) {
    const ok = CLIENT_EDITABLE_FIELDS[k];
    if (!ok) return DENY;
    if (!ok(v)) return { status: 422, body: { error: { type: 'INVALID', message: 'Please check the ' + k.replace(/:$/, '').toLowerCase() + ' value.' } } };
  }
  try {
    const rec = await airtable(`${BASE}/${PROJECTS}/${recordId}`);
    if (!belongsToClient(rec, client) || hiddenFor(client, rec))
      return { status: 404, body: { error: { type: 'NOT_FOUND' } } };
    const update = Object.assign({}, fields);
    if (CLIENT_SHIPPING_FLAG_FIELD) update[CLIENT_SHIPPING_FLAG_FIELD] = true;
    const saved = await airtable(`${BASE}/${PROJECTS}/${recordId}`, { method: 'PATCH', body: { fields: update } });
    return { status: 200, body: (await shapeAll([saved]))[0] };
  } catch (e) {
    return { status: e.status || 502, body: { error: { type: 'UPSTREAM', message: e.message } } };
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────
async function getDashboard(client) {
  const projects = (await dashboardProjects(client)).map(r => {
    const f = r.fields;
    const addr = f['ADDRESS: (from STORE NAME(s) & ADDRESS(es))'];
    return {
      id: r.id,
      name: String(f['PROJECT NAME:'] || f.ID || 'Project'),
      status: statusName(f['PROJECT STATUS']),
      date: notScheduledYet(f) ? '' : String(f['DATE SCHEDULED:'] || f['DATE & TIME SCHEDULED'] || '').slice(0, 10),
      address: Array.isArray(addr) ? (addr[0] || '') : String(addr || '')
    };
  });
  const actions = [];
  projects.forEach(p => {
    const rule = ACTION_RULES.find(r => r.test.test(p.status));
    if (rule) actions.push({ label: rule.label, projectName: p.name, projectId: p.id, severity: rule.severity });
  });
  const steps = {};
  Object.keys(ACCOUNT_STEPS).forEach(k => { steps[k] = ACCOUNT_STEPS[k](client.fields); });
  return {
    user: { firstName: firstName(client), company: companyName(client), logoUrl: logoUrl(client) },
    projects, actions,
    account: { steps, warnings: {} }
  };
}

// ── Feedback (only this client's own submissions) ───────────────────────────
async function listFeedback(client) {
  const formula = `FIND("${quote(client.fields.BUSINESS || client.fields.NAME || '')}", ARRAYJOIN({${FEEDBACK_CLIENT_FIELD}}))`;
  let res;
  try {
    res = await airtable(`${BASE}/${FEEDBACK}?pageSize=100&sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc` +
                         `&filterByFormula=${encodeURIComponent(formula)}`);
  } catch (e) {
    if (e.status === 422) return [];   // the link field hasn't been created yet (SETUP step 2)
    throw e;
  }
  return (res.records || [])
    .filter(r => (r.fields[FEEDBACK_CLIENT_FIELD] || []).includes(client.id))
    .map(r => ({
      id: r.id, text: r.fields.UPDATE || '', status: statusName(r.fields.Status),
      created: r.fields.Created || r.createdTime, author: firstName(client) || 'You',
      mine: true, response: r.fields['AGC RESPONSE'] || ''
    }));
}
async function submitFeedback(client, { text } = {}) {
  text = String(text || '').trim().slice(0, 2000);
  if (!text) throw userError('Please write some feedback first.');
  try {
    await airtable(`${BASE}/${FEEDBACK}`, { method: 'POST', body: { records: [{ fields: { UPDATE: text, [FEEDBACK_CLIENT_FIELD]: [client.id] } }] } });
  } catch (e) {
    if (e.status !== 422) throw e;
    // Link field not created yet: still save it, naming the client in the text.
    await airtable(`${BASE}/${FEEDBACK}`, { method: 'POST', body: { records: [{ fields: { UPDATE: `[${String(client.fields.BUSINESS || client.fields.NAME || 'Client').trim()}] ${text}` } }] } });
  }
  return { ok: true };
}

// ── Company logo ────────────────────────────────────────────────────────────
async function saveLogo(client, { file } = {}) {
  if (!file || !/^image\//.test(file.type || '') || !file.base64) throw userError('Please choose an image file.');
  if (file.base64.length > 7 * 1024 * 1024) throw userError('Logo must be under 5 MB.');
  const up = await airtable(`${BASE}/${client.id}/${CLIENT_LOGO_FIELD_ID}/uploadAttachment`, {
    method: 'POST', host: 'https://content.airtable.com/v0/',
    body: { contentType: file.type, file: file.base64, filename: file.name || 'logo.png' }
  });
  const list = (up.fields && up.fields[CLIENT_LOGO_FIELD_ID]) || [];
  const added = list[list.length - 1];
  if (!added) throw userError('Upload failed. Please try again.');
  // Keep only the new logo so the newest one is always shown.
  await airtable(`${BASE}/${CLIENTS}/${client.id}`, { method: 'PATCH', body: { fields: { LOGO: [{ id: added.id }] } } });
  clientById.delete(client.id);   // next read shows the new logo
  return { url: added.url };
}

// ── Purchase order upload (Pricing) ─────────────────────────────────────────
// The client sends their PO for one of their own projects: a record in
// 📄 PURCHASE ORDERS (PO number + the file) linked to the project, which
// shows up as the project's CLIENT PO NUMBER: / CLIENT PO. PO Received is
// ticked and AGC gets a note in PORTAL UPDATES. A PO number already linked to
// the project gets the new file added instead of a second record.
const PO_FIELD = { number: 'fldMdTZ4wACwEa9TT', projects: 'fldBmGn4gcin5EC3t', file: 'fldTdSWXyPF64mLIW' };   // PO NUMBER, AGC PROJECTS link, PO file
async function uploadPO(client, { projectId, poNumber, file } = {}) {
  if (!isRecId(projectId)) throw userError('Please pick a project first.');
  const num = String(poNumber || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!num) throw userError('Please enter your PO number.');
  const type = String((file && file.type) || '').toLowerCase();
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(String((file && file.name) || ''));
  if (!file || !file.base64 || !(isPdf || /^image\/(png|jpe?g)$/.test(type))) throw userError('Please choose a PDF (or a JPG / PNG photo of your PO).');
  if (file.base64.length > 7 * 1024 * 1024) throw userError('The file must be under 5 MB.');
  const rec = await airtable(`${BASE}/${PROJECTS}/${projectId}`);
  if (!belongsToClient(rec, client) || hiddenFor(client, rec)) throw userError('That project was not found.');
  const linked = linkIds(rec.fields['CLIENT PO NUMBER:']);
  if (linked.length) await resolveNames(PURCHASE_ORDERS, linked);
  let poId = linked.find(id => nameOf(id).toLowerCase() === num.toLowerCase());
  if (!poId) {
    const made = await airtable(`${BASE}/${PURCHASE_ORDERS.table}`, { method: 'POST',
      body: { records: [{ fields: { [PO_FIELD.number]: num, [PO_FIELD.projects]: [projectId] } }] } });
    poId = made.records && made.records[0] && made.records[0].id;
    if (!poId) throw userError('Could not save your PO. Please try again.');
  }
  const name = String(file.name || ('PO ' + num + '.pdf')).replace(/[^\w .()#-]+/g, '_').slice(0, 120);
  await airtable(`${BASE}/${poId}/${PO_FIELD.file}/uploadAttachment`, {
    method: 'POST', host: 'https://content.airtable.com/v0/',
    body: { contentType: isPdf ? 'application/pdf' : type, file: file.base64, filename: name }
  });
  nameCache.set(poId, { name: num, at: Date.now() });
  try { await airtable(`${BASE}/${PROJECTS}/${projectId}`, { method: 'PATCH', body: { fields: { 'PO Received': true } } }); } catch (e) { /* the PO itself is saved */ }
  try { await submitFeedback(client, { text: `PO ${num} uploaded from the client portal for ${String(rec.fields['PROJECT NAME:'] || projectId).trim()} (file: ${name}).` }); } catch (e) { /* note is a nicety */ }
  const fresh = await airtable(`${BASE}/${PROJECTS}/${projectId}`);
  return (await shapeAll([fresh]))[0];
}

// ── Cancel a project (client) ───────────────────────────────────────────────
// From the status pill in My Projects, after the client confirms. Sets
// PROJECT STATUS to CANCELLED (and Reason Project Cancelled), on the project
// and on any of its subprojects the client chose to cancel with it, then
// tells AGC in PORTAL UPDATES. Only projects that haven't been installed,
// invoiced, paid or cancelled can be cancelled.
const CANCELLED_STATUS = '💀 CANCELLED 💀';
const CANCELLABLE = st => !/COMPLETE|INVOICE|PAID|NO CHARGE|CANCEL|IN PROGRESS|PHOTOS|PENDING CHARGES|FINAL COSTS|TEST/i.test(st);
const CANCEL_REASONS = {   // the client's choice → Reason Project Cancelled option
  client:    "Client's Client Cancelled The Project",
  notwon:    'Client did not win the project',
  other_installer: 'Client found someone else',
  self:      'Client installed themselves',
  price:     'AGC Price Too High',
  duplicate: 'DUPLICATE',
  mistake:   'Mistakenly sent to AGC',
  other:     'Unknown variables - Client cancelled with AGC'
};
async function cancelProject(client, { projectId, childIds, reason, note } = {}) {
  if (!isRecId(projectId)) throw userError('Please pick a project first.');
  const ids = [projectId].concat((Array.isArray(childIds) ? childIds : []).filter(isRecId)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 60);
  const recs = [];
  for (const id of ids) {
    const rec = await airtable(`${BASE}/${PROJECTS}/${id}`);
    if (!belongsToClient(rec, client) || hiddenFor(client, rec)) { if (id === projectId) throw userError('That project was not found.'); continue; }
    const st = statusName(rec.fields['PROJECT STATUS']);
    if (!CANCELLABLE(st)) { if (id === projectId) throw userError('This project can no longer be cancelled from the portal. Please contact your project manager.'); continue; }
    recs.push(rec);
  }
  const why = CANCEL_REASONS[reason] || CANCEL_REASONS.other;
  for (let i = 0; i < recs.length; i += 10) {
    const fields = { 'PROJECT STATUS': CANCELLED_STATUS, 'Reason Project Cancelled': why };
    try {
      await airtable(`${BASE}/${PROJECTS}`, { method: 'PATCH', body: { records: recs.slice(i, i + 10).map(r => ({ id: r.id, fields })) } });
    } catch (e) {
      if (e.status !== 422) throw e;   // reason option renamed: still cancel
      await airtable(`${BASE}/${PROJECTS}`, { method: 'PATCH', body: { records: recs.slice(i, i + 10).map(r => ({ id: r.id, fields: { 'PROJECT STATUS': CANCELLED_STATUS } })) } });
    }
  }
  const main = recs.find(r => r.id === projectId), title = String((main && main.fields['PROJECT NAME:']) || projectId).trim();
  const extra = recs.length - 1, text = String(note || '').trim().slice(0, 1000);
  try { await submitFeedback(client, { text: `Project CANCELLED from the client portal: ${title}${extra > 0 ? ` (and ${extra} subproject${extra === 1 ? '' : 's'})` : ''}. Reason: ${why}.${text ? ' Note: ' + text : ''}` }); } catch (e) { /* the cancel itself is saved */ }
  const fresh = [];
  for (const r of recs) fresh.push(await airtable(`${BASE}/${PROJECTS}/${r.id}`));
  return { records: await shapeAll(fresh) };
}

// ── Web methods called by the page code ─────────────────────────────────────
// Every method is open to site visitors (no Wix login); access comes from the
// session token issued by clientLogin / clientCreatePassword. Errors come
// back as { error } because Wix hides the text of thrown errors.

// TEMPORARY PASSWORD (Chris, Nov 21 2026): a first visit needs the one-time code AGC sent (PORTAL TEMP PASSWORD on
// AGC CLIENTS) before a password can be created, so a forwarded or guessed link is not enough. The code is cleared
// when the password is created.
const TEMP_FIELD = 'PORTAL TEMP PASSWORD';
const tempOf = (rec) => String((rec && rec.fields && rec.fields[TEMP_FIELD]) || '').trim();
const needsTemp = (rec) => !!rec && !pwOf(rec);
function tempOk(rec, temp) { const want = tempOf(rec), got = String(temp || '').trim(); return !!want && !!got && got.length <= 200 && sameText(got.toUpperCase(), want.toUpperCase()); }
const NO_TEMP = "Your portal isn't ready yet. Ask your AGC project manager for your temporary password, or call 1 (877) 395-7435.";
const BAD_TEMP = "That temporary password isn't right. Check the email from AGC and try again.";
// SCRAMBLED PASSWORDS (Chris, Nov 21 2026): PASSWORD holds a salted PBKDF2 fingerprint, never the password itself,
// like the installer portal. A password still stored the old readable way is checked once and converted at that sign-in.
const PBKDF2_ROUNDS = 600000;
const isHashed = (s) => String(s || '').startsWith('pbkdf2-sha256$');
function pbkdf2(password, salt, rounds) { return new Promise((resolve, reject) => crypto.pbkdf2(String(password), salt, rounds, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key)))); }
async function hashPassword(password) { const salt = crypto.randomBytes(16); const key = await pbkdf2(password, salt, PBKDF2_ROUNDS); return 'pbkdf2-sha256$' + PBKDF2_ROUNDS + '$' + salt.toString('base64') + '$' + key.toString('base64'); }
async function passwordMatches(password, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2-sha256') return false;
  const rounds = parseInt(p[1], 10);
  if (!(rounds >= 10000 && rounds <= 5000000)) return false;
  let salt, want; try { salt = Buffer.from(p[2], 'base64'); want = Buffer.from(p[3], 'base64'); } catch (e) { return false; }
  if (!salt.length || want.length !== 32) return false;
  return crypto.timingSafeEqual(await pbkdf2(password, salt, rounds), want);
}
async function pwOk(password, stored) { return isHashed(stored) ? passwordMatches(password, stored) : sameText(stored, password); }

// Who a personal link belongs to (for "Welcome back, Jordan").
export const clientLookup = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    if (!isRecId(opts.client)) return {};
    const rec = await getClientRecord(opts.client);
    if (!rec || blocked(rec)) return {};
    return { firstName: firstName(rec), company: companyName(rec), hasPassword: !!pwOf(rec), needsTemp: needsTemp(rec),
             email: maskEmail(rec.fields['EMAIL ADDRESS']), emailHint:   /* masked (Nov 21 2026) */ maskEmail(rec.fields['EMAIL ADDRESS']) };
  } catch (e) { return { error: explain(e) }; }
});

// Sign in: password (from a personal link) or email + password.
export const clientLogin = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    const password = String(opts.password || '').trim();
    const email = normEmail(opts.email);
    const link = isRecId(opts.client) ? opts.client : '';
    const key = link || email;
    if (!password || (!link && !email)) return { error: link ? 'Please enter your password.' : 'Please enter your email and password.' };
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };

    // Staff password on a client's link → that client's portal.
    const staff = await staffPassword();
    if (link && staff && sameText(password, staff)) {
      const rec = await getClientRecord(link, true);
      if (!rec) return { error: 'This link does not match a client in Airtable.' };
      rec.__staff = true;
      return { token: await makeToken(rec.id, 'staff:' + fingerprint(staff)), ...initData(rec) };
    }

    let candidates;
    if (link) {
      const rec = await getClientRecord(link, true);
      candidates = rec && !blocked(rec) ? [rec] : [];
    } else {
      candidates = await clientsByEmail(email);
    }
    if (!candidates.length) { failed(key); return { error: link ? 'This portal link is no longer active. Please contact AGC.' : 'Email or password is incorrect.' }; }
    let match = null;
    for (const r of candidates) { if (pwOf(r) && await pwOk(password, pwOf(r))) { match = r; break; } }
    if (match && !isHashed(pwOf(match))) {   // an old readable password: store it scrambled from now on
      try { const h = await hashPassword(password); await airtable(`${BASE}/${CLIENTS}/${match.id}`, { method: 'PATCH', body: { fields: { [PASSWORD_FIELD]: h } } }); match.fields[PASSWORD_FIELD] = h; clientById.delete(match.id); } catch (e) { console.error('client password convert', e && e.message); }
    }
    if (match) return { token: await makeToken(match.id, fingerprint(pwOf(match))), ...initData(match) };
    if (link && candidates.every(r => !pwOf(r)) && needsTemp(candidates[0])) {   // first visit: the code from AGC
      if (!tempOf(candidates[0])) return { error: NO_TEMP };
      if (tempOk(candidates[0], password)) return { tempOk: true };
      failed(key); return { error: BAD_TEMP };
    }
    if (candidates.every(r => !pwOf(r)))
      return { needsSetup: true, error: link ? '' : 'You have not created a password yet. Open the personal portal link AGC sent you to create one.' };
    failed(key);
    return { error: link ? "That password isn't right. Please try again." : 'Email or password is incorrect.' };
  } catch (e) { return { error: explain(e) }; }
});

// First visit: from their personal link, confirm the email AGC has on file
// (shown on the screen, ticked rather than typed) and create a password.
export const clientCreatePassword = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    const link = isRecId(opts.client) ? opts.client : '';
    if (!link) return { error: 'To create your password, open the personal portal link AGC sent you.' };
    if (locked(link)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
    const rec = await getClientRecord(link, true);
    if (!rec || blocked(rec)) return { error: 'This portal link is no longer active. Please contact AGC.' };
    if (pwOf(rec)) return { error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' };
    if (opts.confirmEmail !== true) return { error: 'Please confirm your email address first.' };
    if (needsTemp(rec)) { if (!tempOf(rec)) return { error: NO_TEMP }; if (!tempOk(rec, opts.temp)) { failed(link); return { error: BAD_TEMP }; } }
    const password = String(opts.password || '').trim();
    if (password.length < MIN_PASSWORD) return { error: `Please use at least ${MIN_PASSWORD} characters.` };
    if (password.length > 128) return { error: 'Please use a shorter password.' };
    const stored = await hashPassword(password);   // scrambled, never readable
    await airtable(`${BASE}/${CLIENTS}/${link}`, { method: 'PATCH', body: { fields: { [PASSWORD_FIELD]: stored, [TEMP_FIELD]: '' } } });
    clientById.delete(link);
    rec.fields[PASSWORD_FIELD] = stored;
    return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };
  } catch (e) { return { error: explain(e) }; }
});

// "Forgotten your password?" — tells AGC (PORTAL UPDATES).
export const clientForgotPassword = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    const link = isRecId(opts.client) ? opts.client : '';
    const email = normEmail(opts.email);
    const key = 'forgot|' + (link || email);
    if (locked(key)) return { ok: true };
    failed(key);   // also limits how many requests one person can send
    let rec = link ? await getClientRecord(link) : (email ? (await clientsByEmail(email))[0] : null);
    if (rec && !blocked(rec)) {
      const who = String(rec.fields.BUSINESS || firstName(rec) || 'Client').trim();
      const fields = { UPDATE: `[Password reset request] ${who} (${rec.fields['EMAIL ADDRESS'] || 'no email'}) asked to reset their client portal password. Clear PASSWORD on their AGC CLIENTS record. A new PORTAL TEMP PASSWORD is made automatically; they open their CLIENT PORTAL URL, press "Email me my temporary password", enter it, then create a new password.` };
      try { await airtable(`${BASE}/${FEEDBACK}`, { method: 'POST', body: { records: [{ fields: { ...fields, [FEEDBACK_CLIENT_FIELD]: [rec.id] } }] } }); }
      catch (e) { if (e.status !== 422) throw e; await airtable(`${BASE}/${FEEDBACK}`, { method: 'POST', body: { records: [{ fields }] } }); }
    }
    return { ok: true };   // same answer either way, so it can't be used to test emails
  } catch (e) { return { error: explain(e) }; }
});

// First visit: email me my temporary password (Chris, Nov 21 2026). Stamps TEMP PASSWORD REQUESTED on this link's own
// record; the Airtable automation "Email client their temp password" emails the code to the address on file only.
// Never shows the code or the full address. At most once every 2 minutes (was 10); pressing again inside the 2 minutes
// sends nothing and says so, with how long until they can ask again. { notTemp: true } = they have a password.
const TEMP_ASKED_FIELD = 'TEMP PASSWORD REQUESTED';
const SEND_GAP_MS = 2 * 60 * 1000;
function waitText(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000)), m = Math.floor(s / 60), r = s % 60;
  const part = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  return m ? part(m, 'minute') + (r ? ' ' + part(r, 'second') : '') : part(r, 'second');
}
export const clientSendTemp = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    const link = isRecId(opts.client) ? opts.client : '';
    if (!link) return { notTemp: true };
    const rec = await getClientRecord(link, true);
    if (!rec || pwOf(rec)) return { notTemp: true };
    const mail = String(rec.fields['EMAIL ADDRESS'] || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: "We don't have an email address for you yet. Call AGC at 1 (877) 395-7435 and we'll set you up." };
    if (!tempOf(rec)) return { error: 'Your temporary password is being made. Try again in a minute.' };
    const sent = 'We emailed your temporary password to ' + maskEmail(mail) + '. It can take a minute or two, so check your junk folder too.';   /* 0.15.0: the installer portal's wording */
    const last = Date.parse(rec.fields[TEMP_ASKED_FIELD] || '');
    if (last && Date.now() - last < SEND_GAP_MS) {   // inside the limit: nothing is sent this time
      return { ok: true, already: true, message: 'We already emailed your temporary password to ' + maskEmail(mail) + '. Check your inbox and junk folder. You can ask for another email in ' + waitText(SEND_GAP_MS - (Date.now() - last)) + '.' };
    }
    await airtable(`${BASE}/${CLIENTS}/${rec.id}`, { method: 'PATCH', body: { fields: { [TEMP_ASKED_FIELD]: new Date().toISOString() } } });
    clientById.delete(rec.id);
    return { ok: true, message: sent };
  } catch (e) { return { error: explain(e) }; }
});

// The signed-in client's details (session check on page load).
export const clientInit = webMethod(Permissions.Anyone, async (opts = {}) => {
  try {
    return initData(await sessionClient(opts && opts.token));
  } catch (e) {
    return { error: explain(e), auth: !!e.auth };
  }
});

// Every data request from the dashboard and the projects viewer.
export const clientRequest = webMethod(Permissions.Anyone, async (action, payload = {}, opts = {}) => {
  try {
    const c = await sessionClient(opts && opts.token);
    return await handleRequest(c, action, payload);
  } catch (e) {
    return { __error: explain(e), __auth: !!e.auth };
  }
});
async function handleRequest(c, action, payload) {
  switch (action) {
    case 'getDashboard':   return getDashboard(c);
    case 'airtable':       return proxy(c, payload);
    case 'listFeedback':   return listFeedback(c);
    case 'submitFeedback': return submitFeedback(c, payload);
    case 'saveLogo':       return saveLogo(c, payload);
    case 'uploadPO':       return uploadPO(c, payload);
    case 'cancelProject':  return cancelProject(c, payload);
    default: throw userError('Unknown request.');
  }
}