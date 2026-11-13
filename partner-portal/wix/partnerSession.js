// ─────────────────────────────────────────────────────────────────────────
//  backend/partnerSession.js — shared by partnerPortal.web.js (sign-in)
//  and http-functions.js (the portal's data endpoints).
//
//  One installer session = a signed token made at sign-in:
//      base64url({ c: installerRecordId, x: expiresAt, f: passwordFingerprint }) . HMAC
//  The HMAC key is derived from the AIRTABLE_TOKEN secret, so no extra secret
//  is needed; rotating that token signs every installer out. The fingerprint
//  of the stored password rides in the token, so clearing or changing the
//  password in Airtable ends every session for that installer.
//  Nothing here is ever sent to the browser except the token itself.
// ─────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

export const AIRTABLE_SECRET_NAME = 'AIRTABLE_TOKEN';
export const STAFF_SECRET_NAME = 'AGCPartnerPortalStaff';   // optional: staff password that opens any installer's portal
export const BASE = 'app7LeveIY3JoIqBp';
export const INSTALLERS = 'tblMBJZ7INhXhjDAC';
export const SESSION_DAYS = 1;

// Field IDs on AGC INSTALLERS (renaming a column changes nothing here)
export const IF = {
  firstName: 'fldy6FqMqAnbn3aAY',      // FIRST NAME
  email: 'fldNqCuxttmg4GsWn',          // EMAIL 1
  password: 'fldsx2u4ucwBjXC4b',       // PORTAL PASSWORD (ENCRYPTED)
  passwordSetOn: 'fldQJhr3FWg9RDsqT',  // PORTAL PASSWORD SET ON
  projects: 'fldOwk1SeW6c3SNTQ',       // AGC PROJECTS (installer = INSTALLER(S) on the project)
  extraProjects: 'fldQLlvtjUIBKvRnN'   // projects where they are an ADDITIONAL INSTALLER
};

const AT = 'https://api.airtable.com/v0/';
let _key = null, _keyAt = 0;
export async function airtableKey() {
  if (!_key || Date.now() - _keyAt > 300000) { _key = await getSecret(AIRTABLE_SECRET_NAME); _keyAt = Date.now(); }
  return _key;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function airtable(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await airtableOnce(path, opts); }
    catch (e) { if (e.status !== 429 || attempt >= 2) throw e; await sleep(1200 * (attempt + 1)); }
  }
}
async function airtableOnce(path, { method = 'GET', body } = {}) {
  const key = await airtableKey();
  const res = await fetch(AT + path, {
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

export const isRecId = (v) => /^rec[A-Za-z0-9]{14}$/.test(String(v || ''));
export const pwOf = (rec) => String((rec && rec.fields && rec.fields[IF.password]) || '').trim();
export const firstNameOf = (rec) => String((rec && rec.fields && rec.fields[IF.firstName]) || '').trim();
export const emailOf = (rec) => String((rec && rec.fields && rec.fields[IF.email]) || '').trim();

// Installer record by FIELD ID (cached 60 s; sign-in always reads fresh)
const installerById = new Map();
export async function getInstallerRecord(id, freshRead) {
  if (!isRecId(id)) return null;
  const hit = installerById.get(id);
  if (!freshRead && hit && Date.now() - hit.at < 60000) return hit.rec;
  let rec = null;
  try { rec = await airtable(`${BASE}/${INSTALLERS}/${id}?returnFieldsByFieldId=true`); } catch (e) { if (e.status !== 404) throw e; }
  if (rec) installerById.set(id, { rec, at: Date.now() });
  return rec;
}
export function forgetInstaller(id) { installerById.delete(id); }

let _signKey = null, _signFrom = '';
async function signKey() {
  const secret = await airtableKey();
  if (!_signKey || _signFrom !== secret) {
    _signKey = crypto.createHash('sha256').update('agc-partner-portal-session|' + secret).digest();
    _signFrom = secret;
  }
  return _signKey;
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
export const fingerprint = (stored) => crypto.createHash('sha256').update('pw|' + String(stored || '')).digest('hex').slice(0, 16);

export async function makeToken(installerId, fp) {
  const body = b64u(JSON.stringify({ c: installerId, x: Date.now() + SESSION_DAYS * 864e5, f: fp }));
  return body + '.' + b64u(crypto.createHmac('sha256', await signKey()).update(body).digest());
}
export async function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = b64u(crypto.createHmac('sha256', await signKey()).update(body).digest());
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const d = JSON.parse(unb64u(body).toString('utf8')); return d && isRecId(d.c) && d.x > Date.now() ? d : null; } catch (e) { return null; }
}
export async function staffPassword() { try { return String(await getSecret(STAFF_SECRET_NAME) || '').trim(); } catch (e) { return ''; } }

// The signed-in installer for a token, or null. A token stops working when it
// expires, when the password in Airtable is cleared or changed, or when the
// staff password changes (for staff sessions).
export async function sessionInstaller(token) {
  const d = await readToken(token);
  if (!d) return null;
  const rec = await getInstallerRecord(d.c);
  if (!rec) return null;
  const staff = String(d.f || '').startsWith('staff:');
  const fp = staff ? 'staff:' + fingerprint(await staffPassword()) : fingerprint(pwOf(rec));
  if (d.f !== fp) return null;
  if (staff && fp === 'staff:' + fingerprint('')) return null;
  if (!staff && !pwOf(rec)) return null;
  rec.__staff = staff;
  return rec;
}

// The projects an installer may see: INSTALLER(S) + ADDITIONAL INSTALLER(S).
export function installerProjectIds(rec) {
  const f = (rec && rec.fields) || {};
  const a = Array.isArray(f[IF.projects]) ? f[IF.projects] : [];
  const b = Array.isArray(f[IF.extraProjects]) ? f[IF.extraProjects] : [];
  return [...new Set([...a, ...b].filter(isRecId))];
}
