// Client portal: temporary password + scrambled passwords + masked email (Chris, Nov 21 2026)
(() => {
const get = n => monaco.editor.getModels().find(m => m.uri.toString() === n);
const B = get('file:///backend/clientPortal.web.js'), P = get('file:///public/pages/c8mpt.js');
const be = [
 ['// Who a personal link belongs to (for "Welcome back, Jordan").',
`// TEMPORARY PASSWORD (Chris, Nov 21 2026): a first visit needs the one-time code AGC sent (PORTAL TEMP PASSWORD on
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

// Who a personal link belongs to (for "Welcome back, Jordan").`],
 ['hasPassword: !!pwOf(rec),', 'hasPassword: !!pwOf(rec), needsTemp: needsTemp(rec),'],
 ["email: String(rec.fields['EMAIL ADDRESS'] || '').trim(), emailHint:", "email: maskEmail(rec.fields['EMAIL ADDRESS']), emailHint:   /* masked (Nov 21 2026) */"],
 ['const match = candidates.find(r => pwOf(r) && sameText(pwOf(r), password));',
`let match = null;
    for (const r of candidates) { if (pwOf(r) && await pwOk(password, pwOf(r))) { match = r; break; } }
    if (match && !isHashed(pwOf(match))) {   // an old readable password: store it scrambled from now on
      try { const h = await hashPassword(password); await airtable(\`\${BASE}/\${CLIENTS}/\${match.id}\`, { method: 'PATCH', body: { fields: { [PASSWORD_FIELD]: h } } }); match.fields[PASSWORD_FIELD] = h; clientById.delete(match.id); } catch (e) { console.error('client password convert', e && e.message); }
    }`],
 ['if (candidates.every(r => !pwOf(r)))',
`if (link && candidates.every(r => !pwOf(r)) && needsTemp(candidates[0])) {   // first visit: the code from AGC
      if (!tempOf(candidates[0])) return { error: NO_TEMP };
      if (tempOk(candidates[0], password)) return { tempOk: true };
      failed(key); return { error: BAD_TEMP };
    }
    if (candidates.every(r => !pwOf(r)))`],
 ["if (opts.confirmEmail !== true) return { error: 'Please confirm your email address first.' };",
  "if (opts.confirmEmail !== true) return { error: 'Please confirm your email address first.' };\n    if (needsTemp(rec)) { if (!tempOf(rec)) return { error: NO_TEMP }; if (!tempOk(rec, opts.temp)) { failed(link); return { error: BAD_TEMP }; } }"],
 ["if (password.length > 128) return { error: 'Please use a shorter password.' };",
  "if (password.length > 128) return { error: 'Please use a shorter password.' };\n    const stored = await hashPassword(password);   // scrambled, never readable"],
 ['[PASSWORD_FIELD]: password } } });', "[PASSWORD_FIELD]: stored, [TEMP_FIELD]: '' } } });"],
 ['rec.fields[PASSWORD_FIELD] = password;', 'rec.fields[PASSWORD_FIELD] = stored;'],
 ['return { token: await makeToken(rec.id, fingerprint(password)), ...initData(rec) };', 'return { token: await makeToken(rec.id, fingerprint(stored)), ...initData(rec) };'],
 ["Clear PASSWORD on their AGC CLIENTS record; they'll create a new one from their CLIENT PORTAL URL.",
  "Clear PASSWORD on their AGC CLIENTS record, put a new PORTAL TEMP PASSWORD and send it to them with their CLIENT PORTAL URL; they enter it, then create a new password."],
];
const pe = [
 ['async function askToSignIn(message) {', "let pendingTemp = '';   // the temporary password they just entered (first visit, Nov 21 2026)\n  async function askToSignIn(message, setupReady) {"],
 ['needsSetup: who.hasPassword === false,', 'needsSetup: who.hasPassword === false && (who.needsTemp !== true || !!setupReady),'],
 [": (message || who.error || '') });", ": (message || who.error || (who.hasPassword === false && who.needsTemp === true && !setupReady ? 'First visit? Enter the temporary password AGC sent you as your password.' : '')) });"],
 ['else if (r.needsSetup && LINK) await askToSignIn();', "else if (r.tempOk && LINK) { pendingTemp = m.password || ''; await askToSignIn('Thank you. Now create your own password.', true); }\n          else if (r.needsSetup && LINK) await askToSignIn();"],
 ['confirmEmail: m.confirmEmail === true });', 'confirmEmail: m.confirmEmail === true, temp: pendingTemp });'],
];
const run = (src, list) => { let t = src, counts = []; for (const [a, b] of list) { const c = t.split(a).length - 1; counts.push(c); if (c !== 1) return { error: 'anchor ' + counts.length + ' found ' + c, counts }; t = t.split(a).join(b); } return { text: t, counts }; };
const rb = run(B.getValue(), be), rp = run(P.getValue(), pe);
const parse = (t) => { try { new Function(t.replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?/gm, '').replace(/^export\s+/gm, '')); return 'ok'; } catch (e) { return 'SYNTAX ' + e.message; } };
window.__clientFix = { B: rb.text, P: rp.text, oldB: B.getValue(), oldP: P.getValue() };
return JSON.stringify({ back: rb.error || rb.counts.join(','), page: rp.error || rp.counts.join(','), parseBack: rb.text ? parse(rb.text) : '-', parsePage: rp.text ? parse(rp.text) : '-' });
})()
