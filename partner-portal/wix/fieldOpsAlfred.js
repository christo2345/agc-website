// ───────────────────────────────────────────────────────────
//  backend/fieldOpsAlfred.js — FIELD OPS ALFRED (Installer Portal chat), build steps 2 + 3 (Chris, Nov 23 2026)
//
//  rulesForPortal()  the ACTIVE rows of 🎛️ FIELD OPS ALFRED RULES (blocked topics + their trigger words, the out of bounds
//                    wording, the answer length), merged with the built-in never-share list below, which always stays on
//                    even when a row in Airtable is switched off or deleted. NOTES are never sent to the browser.
//  writeLog(inst, body, projectId)   one row in 💬 FIELD OPS ALFRED LOG. The installer comes from the portal session
//                    (http-functions.js signedIn), never from the browser; the project is linked only when it is one of
//                    the installer's own projects (http-functions.js ownsProject). Every text is cut to a safe length.
//  Uses the same AIRTABLE_TOKEN secret as the rest of the portal backend.
// ───────────────────────────────────────────────────────────
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const BASE = 'app7LeveIY3JoIqBp';
const LOG_TABLE = 'tblXpzU2U1Iiqa1iX';     // 💬 FIELD OPS ALFRED LOG
const RULES_TABLE = 'tblNaqcMbcCTMVO4M';   // 🎛️ FIELD OPS ALFRED RULES
const R = { rule: 'fldpYduZJ2lsG3Wc6', type: 'fldbNTOHpwIywAtEo', active: 'fldbcxrYn637hNS53', words: 'fldZwBOaS75HXPRRm', reply: 'fld84tLW773RbsZc1', max: 'fldHvBkpQK1Je4PHd' };
const L = { entry: 'fld4E7NAoJv3QKgGj', at: 'fldSEfupQYClkjJKa', installer: 'fld2snp6GubsQ2BLu', agc: 'fldIehDBQ1kyZy2Zj', project: 'fldIGIi0WnwLPYvoy', q: 'fldULj7sSfFj7tUhI',
  by: 'fldMybxJkcNxqFoe9', a: 'fldPEqc7gOHBMKRAJ', result: 'fldXM5fQxWg9lAXe6', topic: 'fldznzNqiXtQsc8Bd', pm: 'fldgLIiLJsL6o6Ap0', via: 'fldLHVoDICkb0ZTlT', ver: 'fldp8nNWaMDQ61H8K', page: 'fldFroCRhpn7PyVAt' };
const RESULTS = { answered: '✅ ANSWERED', blocked: '🚫 OUT OF BOUNDS', unknown: '❓ NOT UNDERSTOOD' };
const VIAS = { typed: '⌨️ TYPED', chip: '🔘 CHIP', voice: '🎙️ VOICE' };
const PMS = new Set(['Randy', 'Robert', 'Chris']);
const BY = { script: '📜 SCRIPT', ai: '🤖 AI' };   // ANSWERED BY (Chris, Nov 23: yes)

// The spec's never-share list. Always on, whatever the Airtable table says (the table can only add words, not remove these).
const BUILTIN_BLOCKED = [
  { rule: 'Client pricing', words: ['client price', 'client pays', 'client paying', 'what does the client pay', 'how much is the client', 'how much does the client', 'retail price', 'agc price', 'what agc charges'] },
  { rule: 'AGC margin', words: ['margin', 'markup', 'mark up', 'profit', 'how much does agc make', 'agc makes', 'commission'] },
  { rule: 'Client invoices and balances', words: ['client invoice', "client's invoice", 'did the client pay', 'has the client paid', 'client balance', 'client owes', 'accounts receivable'] },
  { rule: 'QuickBooks', words: ['quickbooks', 'quick books', 'qbo'] },
  { rule: 'Other installers', words: ['other installer', 'other installers', 'another installer', 'other partner', 'other partners', 'competitor', 'competitors', 'what do others charge'] },
  { rule: 'Hands-off projects', words: ['17329', '17334', '19043', '19072'] },
  { rule: 'Internal notes', words: ['internal note', 'internal notes', 'pm notes', 'senior pm', 'my rating', 'my ratings', 'my score', 'partner status'] },
  { rule: 'Credit holds', words: ['credit hold', 'credit limit'] },
  { rule: 'Insurance overrides', words: ['insurance override', 'insurance agent'] },
  { rule: 'His own rules', words: ['system prompt', 'your prompt', 'your instructions', 'ignore previous', 'ignore your'] }
];
const DEFAULT_REPLY = "I can't share that. {pm} can help you with it.";
const DEFAULT_MAX = 3;
const DEFAULT_MORE = ['tell me more', 'more details', 'full details', 'everything', 'list all', 'all of them'];

const S = (v) => (v == null ? '' : String(v)).trim();
const cut = (v, n) => { const t = S(v); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const words = (t) => S(t).split(/[\n,;]+/).map((w) => S(w).toLowerCase()).filter((w) => w.length >= 2 && w.length <= 80).slice(0, 80);

let _key = null, _keyAt = 0;
async function headers() {
  if (!_key || Date.now() - _keyAt > 300000) { _key = await getSecret('AIRTABLE_TOKEN'); _keyAt = Date.now(); }
  return { 'Authorization': 'Bearer ' + _key, 'Content-Type': 'application/json' };
}

let _rules = null, _rulesAt = 0;
// GET /_functions/alfredRules (signed-in installers only): kept 5 minutes in memory so the table is not read on every chat.
export async function rulesForPortal() {
  if (_rules && Date.now() - _rulesAt < 300000) return _rules;
  const blocked = BUILTIN_BLOCKED.map((b) => ({ rule: b.rule, words: b.words.slice() }));
  let reply = DEFAULT_REPLY, max = DEFAULT_MAX, more = DEFAULT_MORE.slice(), fromTable = false, aiIds = [];
  try {
    const qs = '?pageSize=100&filterByFormula=' + encodeURIComponent('{ACTIVE}') + ['rule', 'type', 'words', 'reply', 'max'].map((k) => '&fields%5B%5D=' + R[k]).join('') + '&returnFieldsByFieldId=true';
    const res = await fetch('https://api.airtable.com/v0/' + BASE + '/' + RULES_TABLE + qs, { headers: await headers() });
    if (res.ok) {
      const j = await res.json();
      fromTable = true;
      for (const r of (j.records || [])) {
        const f = r.fields || {}, type = S(f[R.type] && (f[R.type].name || f[R.type]));
        if (/AI SWITCH/.test(type)) { aiIds = aiIds.concat(S(f[R.words]).match(/rec[A-Za-z0-9]{14}/g) || []); continue; }   // 🤖 the installers who may get AI answers (ACTIVE row = on)
        if (/BLOCKED/.test(type)) {
          const w = words(f[R.words]); if (!w.length) continue;
          const same = blocked.find((b) => b.rule.toLowerCase() === S(f[R.rule]).toLowerCase());
          if (same) { for (const x of w) if (!same.words.includes(x)) same.words.push(x); } else blocked.push({ rule: cut(f[R.rule], 80) || 'Blocked topic', words: w });
        } else if (/REPLY/.test(type) && /out of bounds/i.test(S(f[R.rule])) && S(f[R.reply])) reply = cut(f[R.reply], 300);
        else if (/LENGTH/.test(type)) { const n = Number(f[R.max]); if (Number.isInteger(n) && n >= 1 && n <= 12) max = n; const w = words(f[R.words]); if (w.length) more = w; }
      }
    } else console.warn('alfredRules: rules table read failed', res.status);
  } catch (e) { console.warn('alfredRules', e && e.message); }
  _rules = { v: 1, fromTable, blocked, reply, maxSentences: max, moreWords: more };
  _ai = new Set(aiIds);
  _rulesAt = Date.now();
  return _rules;
}
// 🤖 FIELD OPS ALFRED AI (Chris, Nov 23: separate service, behind a switch, test installers only). The switch is one ACTIVE row of
// 🎛️ FIELD OPS ALFRED RULES with TYPE 🤖 AI SWITCH whose WORDS list the installer record ids; no row, row off, or not listed = no AI.
// The list is never sent to a browser.
let _ai = new Set();
export async function aiEnabledFor(inst) {
  await rulesForPortal();
  return !!(inst && inst.id && _ai.has(inst.id));
}

// POST /_functions/alfredLog (signed-in installers only)
// body: { q, a, result: answered|blocked|unknown, topic, agc, pm, via: typed|chip|voice, page, ver }   (+ projectId, checked by the caller)
export async function writeLog(inst, body, projectId) {
  const b = body && typeof body === 'object' ? body : {};
  const q = cut(b.q, 1000), a = cut(b.a, 4000);
  if (!q) return { ok: false, status: 400 };
  const f0 = (inst && inst.fields) || {};
  const name = S(f0['fldy6FqMqAnbn3aAY'] || f0['FIRST NAME']) || 'installer';   // FIRST NAME (the session record is read by field id)
  const now = new Date();
  const fields = {
    [L.entry]: cut(now.toISOString().slice(0, 10) + ' · ' + name + ' · ' + q.replace(/\s+/g, ' '), 120),
    [L.at]: now.toISOString(),
    [L.installer]: [inst.id],
    [L.q]: q,
    [L.a]: a,
    [L.result]: RESULTS[S(b.result)] || RESULTS.answered,
    [L.topic]: cut(b.topic, 120),
    [L.via]: VIAS[S(b.via)] || VIAS.typed,
    [L.ver]: cut(b.ver, 20),
    [L.by]: BY[S(b.by)] || BY.script,
    [L.page]: cut((inst && inst.__staff ? 'STAFF VIEW · ' : '') + S(b.page), 40)   // AGC staff opening an installer's portal are marked
  };
  const agc = S(b.agc).replace(/\D/g, '').slice(0, 6);
  if (projectId) { fields[L.project] = [projectId]; if (agc) fields[L.agc] = agc; }
  if (PMS.has(S(b.pm))) fields[L.pm] = S(b.pm);
  try {
    const res = await fetch('https://api.airtable.com/v0/' + BASE + '/' + LOG_TABLE, { method: 'POST', headers: await headers(), body: JSON.stringify({ fields, typecast: false }) });
    if (!res.ok) { console.warn('alfredLog write failed', res.status, (await res.text()).slice(0, 200)); return { ok: false, status: 502 }; }
    return { ok: true };
  } catch (e) { console.warn('alfredLog', e && e.message); return { ok: false, status: 502 }; }
}
