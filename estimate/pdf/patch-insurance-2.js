// Nov 13 (Chris approved: accounting@ emails must reach the insurance intake)
// Every email to accounting@ already reaches the 🧾 INVOICE READER webhook (Missive rule "INVOICE READER - installer invoices sent to accounting@").
// The 🤖 Smart reply webhook rule only covers projects@, so a COI sent to accounting@ never reached the 📎 INSURANCE INTAKE.
// Now: the INVOICE READER hands an insurance-looking accounting@ email to the Smart reply webhook with insurance_only = true, and Smart reply
// then runs ONLY the insurance intake for it (no reply draft, no thread updates / PO / invoice / tracking forwards). The intake runs once per
// message (🔁 PROCESSED MESSAGES), so an email sent to both projects@ and accounting@ is still handled once.
const SR_HOOK = 'https://hooks.airtable.com/workflows/v1/genericWebhook/app7LeveIY3JoIqBp/wfl10OYVWJLYZZxkx/wtrqp4vQ3pnpShFrv';

function patchInvoice(src) {
  const a = "    if (AGC.test(L(pm.from_field && pm.from_field.address))) { out.reason = 'sent by AGC'; return; }\n    { const dup = await __claim('INVOICE READER'";
  if (src.split(a).length !== 2) throw new Error('anchor not found (invoice reader)');
  return src.split(a).join(
    "    if (AGC.test(L(pm.from_field && pm.from_field.address))) { out.reason = 'sent by AGC'; return; }\n" +
    "    // 🛡️ Nov 13 (Devil Dog COI to accounting@): an insurance-looking email from the accounting@ rule also goes to the 📎 INSURANCE INTAKE\n" +
    "    // (Smart reply webhook, insurance_only = true: only the intake runs there, no reply draft). Never blocks the invoice check below.\n" +
    "    if (p.rule && !p.insurance_only) { try { const at = Array.isArray(pm.attachments) ? pm.attachments : []; const tx = S(pm.subject) + ' ' + S(pm.preview);\n" +
    "      const insLike = at.some(f => /coi|certif|insur|liab|acord|csio|coverage|wcb|wsib/i.test(S(f && f.filename))) || (/\\bcoi\\b|insurance|certificate of|liability|acord|additional(ly)? insured/i.test(tx) && at.some(f => /\\.pdf$/i.test(S(f && f.filename))));\n" +
    "      if (insLike) { const r = await fetch('" + SR_HOOK + "', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({conversation: p.conversation, message: pm, insurance_only: true})}); console.log('🛡️ insurance-looking email sent to the insurance intake: ' + r.status); } }\n" +
    "    catch (e) { console.log('insurance forward: ' + e); } }\n" +
    "    { const dup = await __claim('INVOICE READER'");
}

function patchSmart(src) {
  const a = "  const cid = S(p.conversation && p.conversation.id), mid = S(pm.id);\n";
  if (src.split(a).length !== 2) throw new Error('anchor not found (smart reply)');
  return src.split(a).join(a +
    "  // 🛡️ Nov 13: an accounting@ email handed over by the 🧾 INVOICE READER (insurance_only): only the 📎 INSURANCE INTAKE runs, nothing else\n" +
    "  if (p.insurance_only) { if (cid && mid && !AGC.test(L(pm.from_field && pm.from_field.address))) { try { const ir = await __insIntake(cid, mid, pm, false); out.reason = 'insurance intake only (accounting@): ' + ir; } catch (e) { out.reason = 'insurance intake failed: ' + e; } } else out.reason = 'insurance intake only: nothing to do'; console.log(out.reason); return; }\n");
}

window.__applyIns2 = function (which) {
  const m = monaco.editor.getModels()[0];
  const before = m.getValue();
  if (/Nov 13 \(Devil Dog COI to accounting@\)|accounting@ email handed over by the 🧾 INVOICE READER/.test(before)) return 'already patched';
  const after = which === 'invoice' ? patchInvoice(before) : patchSmart(before);
  m.pushEditOperations([], [{range: m.getFullModelRange(), text: after}], () => null);
  return 'patched ' + which + ': ' + before.length + ' -> ' + m.getValue().length;
};
window.__ins2Loaded = true;
if (typeof module !== 'undefined') module.exports = {patchInvoice, patchSmart};
