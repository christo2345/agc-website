// ─────────────────────────────────────────────────────────────────────────
//  backend/partnerPortal.web.js — sign-in for the Partner (installer) Portal
//
//  The same sign-in system as the Client Portal (backend/clientPortal.web.js),
//  pointed at AGC INSTALLERS instead of AGC CLIENTS. No Wix login:
//
//    • Each installer has a personal link (their VENDOR PORTAL URL):
//        https://www.americangraphiccontractors.com/vendor-portal?id=<record id>
//      The link says who they are, so the sign-in screen greets them by name
//      and asks only for their password. Without the link they sign in with
//      email + password.
//    • First visit (no password yet): from their personal link they create a
//      password. It is saved to PORTAL PASSWORD (ENCRYPTED) as a salted
//      PBKDF2 fingerprint, never as readable text, with the date in
//      PORTAL PASSWORD SET ON.
//    • Forgotten password: the request lands in PORTAL UPDATES; AGC clears
//      PORTAL PASSWORD (ENCRYPTED) on the installer's record and the
//      installer creates a new one from their link.
//    • The page code keeps the session in memory only, so a refresh or a new
//      visit asks for the password again. A session lasts at most
//      SESSION_DAYS even if the page stays open. Clearing or changing the
//      password in Airtable signs that installer out everywhere.
//    • Optional staff access: store a secret named STAFF_SECRET_NAME in Wix;
//      typing it as the password on any installer's link opens their portal.
//
//  Secrets Manager: AIRTABLE_TOKEN (the same token http-functions.js uses)
//  must be able to read and write AGC INSTALLERS and create PORTAL UPDATES.
// ─────────────────────────────────────────────────────────────────────────
import { Permissions, webMethod } from 'wix-web-module';
import crypto from 'crypto';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const AIRTABLE_SECRET_NAME = 'AIRTABLE_TOKEN';

const BASE = 'app7LeveIY3JoIqBp';          // TEAM AGC
const INSTALLERS = 'tblMBJZ7INhXhjDAC';    // AGC INSTALLERS
const UPDATES = 'tblpXDJaUe4DXyl0A';       // PORTAL UPDATES

// Fields are addressed by ID, so renaming a column in Airtable changes nothing here.
const F = {
  firstName: 'fldy6FqMqAnbn3aAY',          // FIRST NAME
  email: 'fldNqCuxttmg4GsWn',              // EMAIL 1
  password: 'fldsx2u4ucwBjXC4b',           // PORTAL PASSWORD (ENCRYPTED)
  passwordSetOn: 'fldQJhr3FWg9RDsqT'       // PORTAL PASSWORD SET ON
};
const U = {
  text: 'fld0DgDA2hhtpn12b',               // the update itself
  installer: 'fld2F9Vq0dxRzeS1N'           // link to AGC INSTALLERS
};
const INSTALLER_FIELDS = [F.firstName, F.email, F.password];

const SESSION_DAYS = 1;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const STAFF_SECRET_NAME = 'AGCPartnerPortalStaff';   // optional
const MAX_FAILS = 8, FAIL_WINDOW_MS = 15 * 60 * 1000;
const PBKDF2_ROUNDS = 600000;

// ── Airtable helpers ─────────────────────────────────────────────────────
const AT = 'https://api.airtable.com/v0/';
const quote = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Wix replaces errors thrown from web methods with a generic message, so the
// web methods below return { error } instead. userError marks messages that
// are safe to show; anything else is turned into a plain explanation.
function userError(msg) { const e = new Error(msg); e.userFacing = true; return e; }
function explain(e) {
  if (e && e.userFacing) return e.message;
  const st = e && e.status;
  console.error('AGC partner portal:', st || '', e && e.message);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Airtable allows 5 requests a second per base; a 429 is retried twice.
async function airtable(path, opts = {}) {
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
const fieldsQuery = (ids) => ids.map((f) => 'fields%5B%5D=' + encodeURIComponent(f)).join('&');

// ── Sign-in (no Wix login) ───────────────────────────────────────────────
const isRecId = (v) => /^rec[A-Za-z0-9]{14}$/.test(String(v || ''));
const normEmail = (v) => String(v || '').trim().toLowerCase();
const blocked = () => false;   // no status blocks portal access
const pwOf = (rec) => String((rec && rec.fields && rec.fields[F.password]) || '').trim();
const firstName = (rec) => String((rec && rec.fields && rec.fields[F.firstName]) || '').trim();
const emailOf = (rec) => String((rec && rec.fields && rec.fields[F.email]) || '').trim();

let _signKey = null;
async function signKey() {
  if (!_signKey) _signKey = crypto.createHash('sha256').update('agc-partner-portal-session|' + await getSecret(AIRTABLE_SECRET_NAME)).digest();
  return _signKey;
}
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
// A short fingerprint of what is stored in the password field: it rides in the
// session token, so changing or clearing the password ends every session.
const fingerprint = (stored) => crypto.createHash('sha256').update('pw|' + String(stored || '')).digest('hex').slice(0, 16);
function sameText(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
async function makeToken(installerId, fp) {
  const body = b64u(JSON.stringify({ c: installerId, x: Date.now() + SESSION_DAYS * 864e5, f: fp }));
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

// Passwords are stored as "pbkdf2-sha256$<rounds>$<salt>$<hash>" (base64), never as readable text.
function pbkdf2(password, salt, rounds) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, rounds, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key)));
  });
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await pbkdf2(password, salt, PBKDF2_ROUNDS);
  return 'pbkdf2-sha256$' + PBKDF2_ROUNDS + '$' + salt.toString('base64') + '$' + key.toString('base64');
}
async function passwordMatches(password, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2-sha256') return false;
  const rounds = parseInt(p[1], 10);
  if (!(rounds >= 10000 && rounds <= 5000000)) return false;
  let salt, want;
  try { salt = Buffer.from(p[2], 'base64'); want = Buffer.from(p[3], 'base64'); } catch (e) { return false; }
  if (!salt.length || want.length !== 32) return false;
  const got = await pbkdf2(password, salt, rounds);
  return crypto.timingSafeEqual(got, want);
}

// Failed-attempt limit (per email / per link), best effort.
const fails = new Map();
function locked(key) { const f = fails.get(key); return !!f && f.n >= MAX_FAILS && Date.now() - f.at < FAIL_WINDOW_MS; }
function failed(key) { const f = fails.get(key); const fresh = !f || Date.now() - f.at > FAIL_WINDOW_MS; fails.set(key, { n: fresh ? 1 : f.n + 1, at: fresh ? Date.now() : f.at }); }

const installerById = new Map();   // recId → { rec, at }
async function getInstallerRecord(id, freshRead) {
  const hit = installerById.get(id);
  if (!freshRead && hit && Date.now() - hit.at < 60000) return hit.rec;
  let rec = null;
  try { rec = await airtable(`${BASE}/${INSTALLERS}/${id}?returnFieldsByFieldId=true`); } catch (e) { if (e.status !== 404) throw e; }
  if (rec) installerById.set(id, { rec, at: Date.now() });
  return rec;
}
async function installersByEmail(email) {
  const formula = `LOWER(TRIM({EMAIL 1}))="${quote(email)}"`;   // formulas need the field NAME
  const res = await airtable(`${BASE}/${INSTALLERS}?maxRecords=10&returnFieldsByFieldId=true&${fieldsQuery(INSTALLER_FIELDS)}&filterByFormula=${encodeURIComponent(formula)}`);
  return (res.records || []).filter((r) => !blocked(r));
}
function authError(msg) { const e = userError(msg || 'Please sign in.'); e.auth = true; return e; }

// The signed-in installer for a session token (throws authError if not valid).
async function sessionInstaller(token) {
  const d = await readToken(token);
  if (!d) throw authError('Your session has ended. Please sign in again.');
  const rec = await getInstallerRecord(d.c);
  if (!rec || blocked(rec)) throw authError('This account is no longer active. Please contact AGC.');
  const fp = String(d.f || '').startsWith('staff:') ? 'staff:' + fingerprint(await staffPassword()) : fingerprint(pwOf(rec));
  if (d.f !== fp || fp === 'staff:' + fingerprint('')) throw authError('Your password changed. Please sign in again.');
  rec.__staff = String(d.f).startsWith('staff:');
  return rec;
}
function initData(rec) {
  const out = { recordId: rec.id, firstName: firstName(rec) };
  if (rec.__staff) out.notice = 'AGC staff access: you are viewing ' + (firstName(rec) || 'this installer') + "'s portal.";
  return out;
}
function maskEmail(e) {
  const [u, d] = String(e || '').split('@'); if (!d) return '';
  return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.min(6, u.length - 2))) + '@' + d;
}

// ── Web methods (called by the Vendor Portal page code) ──────────────────

// Who is this personal link for? (Greets them by name on the sign-in screen.)
export const partnerLookup = webMethod(Permissions.Anyone, async ({ partner } = {}) => {
  try {
    if (!isRecId(partner)) return {};
    const rec = await getInstallerRecord(partner, true);
    if (!rec || blocked(rec)) return {};
    return { firstName: firstName(rec), email: emailOf(rec), emailHint: maskEmail(emailOf(rec)), hasPassword: !!pwOf(rec) };
  } catch (e) { return { error: explain(e) }; }
});

// Sign in: password from a personal link, or email + password without one.
export const partnerLogin = webMethod(Permissions.Anyone, async ({ partner, email, password } = {}) => {
  try {
    const pw = String(password || ''), mail = normEmail(email), linked = isRecId(partner);
    if (!pw || (!linked && !mail)) return { error: linked ? 'Please enter your password.' : 'Please enter your email and password.' };
    const key = linked ? 'link|' + partner : 'mail|' + mail;
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };

    const staff = await staffPassword();
    if (linked) {
      const rec = await getInstallerRecord(partner, true);
      if (!rec) return { error: 'This link does not match an installer in Airtable.' };
      if (staff && sameText(pw, staff)) { rec.__staff = true; return { token: await makeToken(rec.id, 'staff:' + fingerprint(staff)), ...initData(rec) }; }
      if (blocked(rec)) return { error: 'This portal link is no longer active. Please contact AGC.' };
      const stored = pwOf(rec);
      if (!stored) return { needsSetup: true };
      if (!(await passwordMatches(pw, stored))) { failed(key); return { error: 'That password is incorrect.' }; }
      return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };
    }

    const matches = await installersByEmail(mail);
    for (const rec of matches) {
      const stored = pwOf(rec);
      if (stored && await passwordMatches(pw, stored)) return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };
    }
    failed(key);
    return { error: 'Email or password is incorrect.' };
  } catch (e) { return { error: explain(e) }; }
});

// First visit: create a password (only from the personal link, only when none is set).
export const partnerCreatePassword = webMethod(Permissions.Anyone, async ({ partner, password } = {}) => {
  try {
    if (!isRecId(partner)) return { error: 'To create your password, open the personal portal link AGC sent you.' };
    const key = 'link|' + partner;
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
    const rec = await getInstallerRecord(partner, true);
    if (!rec || blocked(rec)) return { error: 'This portal link is no longer active. Please contact AGC.' };
    if (pwOf(rec)) { failed(key); return { error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' }; }
    const pw = String(password || '');
    if (pw.trim().length < MIN_PASSWORD) return { error: 'Please use at least ' + MIN_PASSWORD + ' characters.' };
    if (pw.length > MAX_PASSWORD) return { error: 'Please use a shorter password.' };
    const stored = await hashPassword(pw);
    await airtable(`${BASE}/${INSTALLERS}/${rec.id}`, { method: 'PATCH', body: { fields: { [F.password]: stored, [F.passwordSetOn]: new Date().toISOString() } } });
    installerById.delete(rec.id);
    return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };
  } catch (e) { return { error: explain(e) }; }
});

// "Forgotten your password?": tell AGC (a row in PORTAL UPDATES). Always answers ok,
// so the screen never reveals whether an email is on file.
export const partnerForgotPassword = webMethod(Permissions.Anyone, async ({ partner, email } = {}) => {
  try {
    const mail = normEmail(email), linked = isRecId(partner);
    const key = 'forgot|' + (linked ? partner : mail);
    if (locked(key)) return { ok: true };
    failed(key);
    let rec = linked ? await getInstallerRecord(partner, true) : null;
    if (!rec && mail) rec = (await installersByEmail(mail))[0] || null;
    if (!rec) return { ok: true };
    const who = firstName(rec) || 'Installer';
    const text = `[Password reset request] ${who} (${emailOf(rec) || 'no email'}) asked to reset their partner portal password. Clear PORTAL PASSWORD (ENCRYPTED) on their AGC INSTALLERS record; they'll create a new one from their VENDOR PORTAL URL.`;
    try { await airtable(`${BASE}/${UPDATES}`, { method: 'POST', body: { records: [{ fields: { [U.text]: text, [U.installer]: [rec.id] } }] } }); }
    catch (e) { await airtable(`${BASE}/${UPDATES}`, { method: 'POST', body: { records: [{ fields: { [U.text]: text } }] } }); }
    return { ok: true };
  } catch (e) { return { error: explain(e) }; }
});

// Is this session still good? (Asked when the portal loads.)
export const partnerInit = webMethod(Permissions.Anyone, async ({ token } = {}) => {
  try { return initData(await sessionInstaller(token)); }
  catch (e) { return { error: explain(e), auth: !!(e && e.auth) }; }
});
