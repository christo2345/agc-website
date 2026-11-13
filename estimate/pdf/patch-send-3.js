// Nov 13 round 3 for the 'Send Estimate To Client' script: pick the client's PROJECT conversation, not an accounting / invoice thread
// that has the same AGC # in its subject. Each thread with the AGC # is opened: any message from accounting@ / billing@ or about an
// invoice, payment or statement rules it out; the client's own messages and 'quote' / 'estimate' count for it.
function patchSend3(src) {
  const rep = (o, n) => { const c = src.split(o).length - 1; if (c !== 1) throw new Error((c ? 'many' : 'not found') + ': ' + o.slice(0, 70)); src = src.split(o).join(n); };
  rep("if (!hit && est) { const words", [
    "{ // 🧵 the project conversation with the client (Chris, Nov 13): never the accounting / invoice thread",
    "const cands = convs.filter(cv => cv.messages_count !== 0 && !ACCT(cv) && ((S(cv.subject) + ' ' + S(cv.latest_message_subject)).match(/\\d+/g) || []).includes(agcNo))",
    ".sort((a, b) => (Number(b.last_activity_at) || 0) - (Number(a.last_activity_at) || 0)).slice(0, 6);",
    "let best = null, bestScore = -99;",
    "for (const cv of cands) { let ms = []; try { const r2 = await globalThis.fetch(API + '/conversations/' + encodeURIComponent(cv.id) + '/messages?limit=10', {headers: H('MISSIVE_TOKEN')}); ms = r2.ok ? ((await r2.json()).messages || []) : []; } catch (e2) {}",
    "const froms = ms.map(m => S(m.from_field && m.from_field.address).toLowerCase()), subs = ms.map(m => S(m.subject)).join(' '), prev = ms.map(m => S(m.preview)).join(' ');",
    "if (froms.some(f => /^(accounting|billing|invoices?|ar|ap)@/.test(f)) || /invoice|payment|statement|receipt|remit|past due/i.test(subs)) continue;",
    "const score = (froms.includes(e) ? 2 : 0) + (/quote|estimate/i.test(S(cv.subject) + ' ' + subs + ' ' + prev) ? 1 : 0) - (/\\binvoice|payment/i.test(prev) ? 2 : 0);",
    "if (score > bestScore) { best = cv; bestScore = score; } }",
    "hit = best; }",
    "if (!hit && est) { const words"].join('\n'));
  return src;
}
if (typeof module !== 'undefined') module.exports = patchSend3;
