// ─────────────────────────────────────────────────────────────────────────
//  backend/partnerPortal.web.js — sign-in for the Partner (installer) Portal
//
//  Same sign-in system as the Client Portal (backend/clientPortal.web.js),
//  pointed at AGC INSTALLERS. No Wix login:
//    • Each installer has a personal link (VENDOR PORTAL URL):
//        https://www.americangraphiccontractors.com/vendor-portal?id=<record id>
//      The link says who they are, so the sign-in screen greets them by name
//      and asks only for their password. Without the link: email + password.
//    • First visit (no password yet): from the personal link they create a
//      password. Saved to PORTAL PASSWORD (ENCRYPTED) as a salted PBKDF2
//      fingerprint, never readable text, with the date in PORTAL PASSWORD SET ON.
//      The password is checked HERE, on the server. The browser never sees the
//      stored fingerprint.
//    • TEMPORARY PASSWORD (Chris, Nov 20 2026): the link alone is not enough to
//      create a password. The installer first enters the one-time code AGC sent
//      them (PORTAL TEMP PASSWORD), then creates their own; the code is cleared
//      then. Only a profile created in the last 2 hours (a brand-new partner who
//      just signed up on this page) skips it.
//    • Forgotten password: a row lands in PORTAL UPDATES; AGC clears
//      PORTAL PASSWORD (ENCRYPTED), puts a new PORTAL TEMP PASSWORD and sends it;
//      the installer creates a new password from their link.
//    • Signed in = a session token (backend/partnerSession.js) that the portal
//      sends with every data call (backend/http-functions.js). It lasts at most
//      1 day; clearing or changing the password ends it.
//    • Optional staff access: a Wix secret named AGCPartnerPortalStaff; typing
//      it as the password on any installer's link opens their portal.
//  (Nov 13 2026: built from the reference in the AGC website repo, now sharing
//  backend/partnerSession.js with http-functions.js.)
// ─────────────────────────────────────────────────────────────────────────
import { Permissions, webMethod } from 'wix-web-module';
import crypto from 'crypto';
import {
  AIRTABLE_SECRET_NAME, BASE, INSTALLERS, IF, airtable, isRecId, pwOf, tempOf, firstNameOf, emailOf,
  getInstallerRecord, forgetInstaller, makeToken, fingerprint, staffPassword, sessionInstaller
} from 'backend/partnerSession';

const UPDATES = 'tblpXDJaUe4DXyl0A';       // PORTAL UPDATES
const U = { text: 'fld0DgDA2hhtpn12b', installer: 'fld2F9Vq0dxRzeS1N' };
const MIN_PASSWORD = 8, MAX_PASSWORD = 200;
const MAX_FAILS = 8, FAIL_WINDOW_MS = 15 * 60 * 1000;
const PBKDF2_ROUNDS = 600000;

const quote = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const normEmail = (v) => String(v || '').trim().toLowerCase();

function userError(msg) { const e = new Error(msg); e.userFacing = true; return e; }
function explain(e) {
  if (e && e.userFacing) return e.message;
  const st = e && e.status;
  console.error('AGC partner portal:', st || '', e && e.message);
  if (st === 401 || st === 403) return 'The portal could not sign in to Airtable. Check the Wix secret "' + AIRTABLE_SECRET_NAME + '".';
  if (st === 404) return 'The portal could not find the AGC Airtable base or table.';
  if (st === 429) return 'Airtable is busy right now. Please try again in a moment.';
  return 'Something went wrong loading your portal. Please try again.';
}

function sameText(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function pbkdf2(password, salt, rounds) {
  return new Promise((resolve, reject) => crypto.pbkdf2(String(password), salt, rounds, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key))));
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

const fails = new Map();
function locked(key) { const f = fails.get(key); return !!f && f.n >= MAX_FAILS && Date.now() - f.at < FAIL_WINDOW_MS; }
function failed(key) { const f = fails.get(key); const fresh = !f || Date.now() - f.at > FAIL_WINDOW_MS; fails.set(key, { n: fresh ? 1 : f.n + 1, at: fresh ? Date.now() : f.at }); }

async function installersByEmail(email) {
  const formula = `LOWER(TRIM({EMAIL 1}))="${quote(email)}"`;
  const fq = [IF.firstName, IF.email, IF.password].map((f) => 'fields%5B%5D=' + encodeURIComponent(f)).join('&');
  const res = await airtable(`${BASE}/${INSTALLERS}?maxRecords=10&returnFieldsByFieldId=true&${fq}&filterByFormula=${encodeURIComponent(formula)}`);
  return res.records || [];
}
function initData(rec) {
  const out = { recordId: rec.id, firstName: firstNameOf(rec) };
  if (rec.__staff) out.notice = 'AGC staff access: you are viewing ' + (firstNameOf(rec) || 'this installer') + "'s portal.";
  return out;
}
// A profile made in the last 2 hours is a brand-new partner who just signed up here: no code to enter.
function brandNew(rec) { const t = Date.parse((rec && rec.createdTime) || ''); return !!t && Date.now() - t < 2 * 3600 * 1000; }
function needsTemp(rec) { return !pwOf(rec) && !brandNew(rec); }
// Is this the code AGC sent? (No code on file = cannot set up yet.)
function tempOk(rec, temp) { const want = tempOf(rec), got = String(temp || '').trim(); return !!want && !!got && got.length <= MAX_PASSWORD && sameText(got.toUpperCase(), want.toUpperCase()); }
const NO_TEMP = "Your portal isn't ready yet. Ask your AGC project manager for your temporary password, or call 1 (877) 395-7435.";
const BAD_TEMP = "That temporary password isn't right. Check the email from AGC and try again.";
function maskEmail(e) {
  const [u, d] = String(e || '').split('@'); if (!d) return '';
  return (u.length <= 2 ? u[0] + '•' : u.slice(0, 2) + '•'.repeat(Math.min(6, u.length - 2))) + '@' + d;
}

// Who is this personal link for? (Greets them by name on the sign-in screen.)
export const partnerLookup = webMethod(Permissions.Anyone, async ({ partner } = {}) => {
  try {
    if (!isRecId(partner)) return {};
    const rec = await getInstallerRecord(partner, true);
    if (!rec) return {};
    return { firstName: firstNameOf(rec), emailHint: maskEmail(emailOf(rec)), hasPassword: !!pwOf(rec), needsTemp: needsTemp(rec) };
  } catch (e) { return { error: explain(e) }; }
});

// Sign in: password from a personal link, or email + password without one.
export const partnerLogin = webMethod(Permissions.Anyone, async ({ partner, email, password } = {}) => {
  try {
    const pw = String(password || ''), mail = normEmail(email), linked = isRecId(partner);
    if (!pw || (!linked && !mail)) return { error: linked ? 'Please enter your password.' : 'Please enter your email and password.' };
    if (pw.length > MAX_PASSWORD) return { error: 'That password is incorrect.' };
    const key = linked ? 'link|' + partner : 'mail|' + mail;
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
    const staff = await staffPassword();
    if (linked) {
      const rec = await getInstallerRecord(partner, true);
      if (!rec) return { error: 'This link does not match an AGC partner account.' };
      if (staff && sameText(pw, staff)) { rec.__staff = true; return { token: await makeToken(rec.id, 'staff:' + fingerprint(staff)), ...initData(rec) }; }
      const stored = pwOf(rec);
      if (!stored) return { needsSetup: true };
      if (!(await passwordMatches(pw, stored))) { failed(key); return { error: "That password isn't right. Please try again." }; }
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

// First visit, step 1: the temporary password from AGC (only from the personal link, only when no password is set).
export const partnerCheckTemp = webMethod(Permissions.Anyone, async ({ partner, temp } = {}) => {
  try {
    if (!isRecId(partner)) return { error: 'Open the personal portal link AGC sent you.' };
    const key = 'link|' + partner;
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
    const rec = await getInstallerRecord(partner, true);
    if (!rec) return { error: 'This link does not match an AGC partner account.' };
    if (pwOf(rec)) return { error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' };
    if (!needsTemp(rec)) return { ok: true };
    if (!tempOf(rec)) return { error: NO_TEMP };
    if (!tempOk(rec, temp)) { failed(key); return { error: BAD_TEMP }; }
    return { ok: true };
  } catch (e) { return { error: explain(e) }; }
});

// First visit: "Email me my temporary password". Stamps TEMP PASSWORD REQUESTED on this installer's own record;
// the Airtable automation "Email installer their temp password" then emails the code to the address on file only.
// Never shows the code or the full address. At most once every 2 minutes (Nov 21 2026; was 10). Pressing again inside
// the 2 minutes sends nothing and says so, with how long until they can ask again.
const SEND_GAP_MS = 2 * 60 * 1000;
function waitText(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000)), m = Math.floor(s / 60), r = s % 60;
  const part = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  return m ? part(m, 'minute') + (r ? ' ' + part(r, 'second') : '') : part(r, 'second');
}
export const partnerSendTemp = webMethod(Permissions.Anyone, async ({ partner } = {}) => {
  try {
    if (!isRecId(partner)) return { error: 'Open the personal portal link AGC sent you.' };
    const rec = await getInstallerRecord(partner, true);
    if (!rec) return { error: 'This link does not match an AGC partner account.' };
    if (pwOf(rec)) return { error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' };
    const mail = emailOf(rec);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return { error: "We don't have an email address for you yet. Call AGC at 1 (877) 395-7435 and we'll set you up." };
    if (!tempOf(rec)) return { error: 'Your temporary password is being made. Try again in a minute.' };
    const sent = 'We emailed your temporary password to ' + maskEmail(mail) + '. It can take a minute or two, so check your junk folder too.';
    const last = Date.parse((rec.fields && rec.fields[IF.tempRequested]) || '');
    if (last && Date.now() - last < SEND_GAP_MS) {   // inside the limit: nothing is sent this time
      return { ok: true, already: true, message: 'We already emailed your temporary password to ' + maskEmail(mail) + '. Check your inbox and junk folder. You can ask for another email in ' + waitText(SEND_GAP_MS - (Date.now() - last)) + '.' };
    }
    await airtable(`${BASE}/${INSTALLERS}/${rec.id}`, { method: 'PATCH', body: { fields: { [IF.tempRequested]: new Date().toISOString() } } });
    forgetInstaller(rec.id);
    return { ok: true, message: sent };
  } catch (e) { return { error: explain(e) }; }
});

// First visit, step 2: create a password (only from the personal link, only when none is set, only with AGC's temporary password).
export const partnerCreatePassword = webMethod(Permissions.Anyone, async ({ partner, password, temp } = {}) => {
  try {
    if (!isRecId(partner)) return { error: 'To create your password, open the personal portal link AGC sent you.' };
    const key = 'link|' + partner;
    if (locked(key)) return { error: 'Too many attempts. Please wait 15 minutes and try again.' };
    const rec = await getInstallerRecord(partner, true);
    if (!rec) return { error: 'This link does not match an AGC partner account.' };
    if (pwOf(rec)) { failed(key); return { error: 'A password is already set for this account. Sign in instead, or use "Forgotten your password?".' }; }
    if (needsTemp(rec)) {
      if (!tempOf(rec)) return { error: NO_TEMP };
      if (!tempOk(rec, temp)) { failed(key); return { error: BAD_TEMP, needsTemp: true }; }
    }
    const pw = String(password || '');
    if (pw.trim().length < MIN_PASSWORD) return { error: 'Please use at least ' + MIN_PASSWORD + ' characters.' };
    if (pw.length > MAX_PASSWORD) return { error: 'Please use a shorter password.' };
    const stored = await hashPassword(pw);
    await airtable(`${BASE}/${INSTALLERS}/${rec.id}`, { method: 'PATCH', body: { fields: { [IF.password]: stored, [IF.passwordSetOn]: new Date().toISOString(), [IF.tempPassword]: '' } } });   // the one-time code is used up
    forgetInstaller(rec.id);
    return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };
  } catch (e) { return { error: explain(e) }; }
});

// "Forgotten your password?": tell AGC (a row in PORTAL UPDATES). Always answers ok.
export const partnerForgotPassword = webMethod(Permissions.Anyone, async ({ partner, email } = {}) => {
  try {
    const mail = normEmail(email), linked = isRecId(partner);
    const key = 'forgot|' + (linked ? partner : mail);
    if (locked(key)) return { ok: true };
    failed(key);
    let rec = linked ? await getInstallerRecord(partner, true) : null;
    if (!rec && mail) rec = (await installersByEmail(mail))[0] || null;
    if (!rec) return { ok: true };
    const who = firstNameOf(rec) || 'Installer';
    const text = `[Password reset request] ${who} (${emailOf(rec) || 'no email'}) asked to reset their partner portal password. Clear PORTAL PASSWORD (ENCRYPTED) on their AGC INSTALLERS record. A new PORTAL TEMP PASSWORD is made automatically; they open their VENDOR PORTAL URL, press \"Email me my temporary password\", enter it, then create a new password.`;
    try { await airtable(`${BASE}/${UPDATES}`, { method: 'POST', body: { records: [{ fields: { [U.text]: text, [U.installer]: [rec.id] } }] } }); }
    catch (e) { await airtable(`${BASE}/${UPDATES}`, { method: 'POST', body: { records: [{ fields: { [U.text]: text } }] } }); }
    return { ok: true };
  } catch (e) { return { error: explain(e) }; }
});

// Is this session still good? (Asked when the portal loads again in the same page.)
export const partnerInit = webMethod(Permissions.Anyone, async ({ token } = {}) => {
  try {
    const rec = await sessionInstaller(token);
    if (!rec) return { error: 'Your session has ended. Please sign in again.', auth: true };
    return initData(rec);
  } catch (e) { return { error: explain(e), auth: false }; }
});
