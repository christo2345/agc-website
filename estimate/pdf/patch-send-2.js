// Nov 13 round 2 for the 'Send Estimate To Client' script (applied on top of patch-send.js):
// no second 'Thanks!!' (the PM's Missive signature closes the email), no existing PDFs from the project's file field in the email,
// the new PDF saved to that field on the project, and never the accounting / invoice thread.
function patchSend2(src) {
  const rep = (o, n) => { const c = src.split(o).length - 1; if (c !== 1) throw new Error((c ? 'many' : 'not found') + ': ' + o.slice(0, 70)); src = src.split(o).join(n); };
  rep("P('If anything needs to change, just reply here and we will update it right away.'), BL,\nP('Thanks!!')].join('');",
    "P('If anything needs to change, just reply here and we will update it right away.')].join(''); // the PM's Missive signature closes the email (Chris's starts with 'Thanks!!')");
  rep("const att = [], skipped = [], badFiles = [], replaced = []; let size = 0;", "const att = [], skipped = [], badFiles = [], replaced = [], inIds = []; let size = 0;");
  rep("if (est && /estimate/i.test(name)) { replaced.push(name); continue; }",
    "if (a && typeof a === 'object' && a.id) inIds.push(a.id);\nif (est && (/estimate/i.test(name) || /\\.pdf$/i.test(name) || /pdf/i.test(type))) { replaced.push(name); continue; }");
  rep("const c = input.config();\n", "const c = input.config();\n" +
    "// 🧵 Nov 13 (Chris): the draft goes in the project conversation with the client, never the accounting / invoice thread\n" +
    "const ACCT = cv => { const T = v => (v == null ? '' : String(v)); const sj = T(cv.subject) + ' ' + T(cv.latest_message_subject), tl = T(cv.team && cv.team.name) + ' ' + (cv.shared_labels || []).map(l => T(l && l.name)).join(' ');\n" +
    "const au = (cv.authors || []).map(a => T(a && (a.address || a.email))).join(' ').toLowerCase();\n" +
    "return /invoice|statement|payment|receipt|remit|past due|overdue|credit card|\\bach\\b|accounting|\\binv[-# ]?\\d/i.test(sj) || /account|invoice|billing/i.test(tl) || /accounting@|billing@|invoice|payable|receivable/.test(au); };\n");
  rep("let hit = convs.filter(cv => cv.messages_count !== 0 && ", "let hit = convs.filter(cv => cv.messages_count !== 0 && !ACCT(cv) && ");
  rep("hit = convs.filter(cv => cv.messages_count !== 0 && (Number", "hit = convs.filter(cv => cv.messages_count !== 0 && !ACCT(cv) && (Number");
  rep("let cid = ''; try { const j = await r.json();", "let cid = '', draftObj = null; try { const j = await r.json();");
  rep("cid = S(x && x.conversation && (x.conversation.id || x.conversation)); } catch (e) {}", "cid = S(x && x.conversation && (x.conversation.id || x.conversation)); draftObj = x; } catch (e) {}");
  rep("// 🧾 the estimate's own check: open points go in an internal note for the PM (clients never see notes)",
    "// 🧾 Nov 13 (Chris): the new estimate PDF is also saved on the project, in the same file field the older estimate PDFs are in (they stay; they are just not emailed)\n" +
    "let saved = '';\n" +
    "if (est && pdfName && S(c.recordId)) { try {\n" +
    "const pick = list => { const a = (list || []).find(x => x && S(x.filename) === pdfName && x.url); return a ? S(a.url) : ''; };\n" +
    "let url = pick(draftObj && draftObj.attachments);\n" +
    "if (!url && draftObj && draftObj.id) { const mr = await globalThis.fetch(API + '/messages/' + encodeURIComponent(draftObj.id), {headers: H(key)}); if (mr.ok) { const mj = await mr.json(); const m = Array.isArray(mj.messages) ? mj.messages[0] : mj.messages; url = pick(m && m.attachments); } }\n" +
    "if (!url && cid) { const cr = await globalThis.fetch(API + '/conversations/' + encodeURIComponent(cid) + '/messages?limit=10', {headers: H(key)}); if (cr.ok) { const cj = await cr.json(); for (const m of (cj.messages || [])) { url = pick(m.attachments); if (url) break; } } }\n" +
    "if (!url) throw new Error('Missive gave no file link for the PDF');\n" +
    "const af = PT.fields.filter(f => f.type === 'multipleAttachments');\n" +
    "const pr = await PT.selectRecordAsync(S(c.recordId), {fields: af});\n" +
    "const fld = af.find(f => (pr.getCellValue(f) || []).some(x => inIds.includes(x.id))) || af.find(f => /^\\W*AGC\\s*ESTIMATES?\\W*$/i.test(f.name)) || af.find(f => /ESTIMATE/i.test(f.name) && !/INVOICE/i.test(f.name));\n" +
    "if (!fld) throw new Error('no estimate file field on the project');\n" +
    "const keep = (pr.getCellValue(fld) || []).filter(x => S(x.filename) !== pdfName).map(x => ({id: x.id, url: x.url, filename: x.filename}));\n" +
    "await PT.updateRecordAsync(S(c.recordId), {[fld.id]: [...keep, {url: url, filename: pdfName}]}); saved = fld.name;\n" +
    "} catch (e) { saved = '⚠️ ' + S(e && e.message || e).slice(0, 100); console.log('save pdf: ' + (e && e.stack || e)); } }\n" +
    "// 🧾 the estimate's own check: open points go in an internal note for the PM (clients never see notes)");
  rep("(pdfName ? ' · 📎 ' + pdfName : '')",
    "(pdfName ? ' · 📎 ' + pdfName + (saved ? (/^⚠️/.test(saved) ? ' (NOT saved on the project: ' + saved + ')' : ' (saved to ' + saved + ')') : '') : '')");
  return src;
}
if (typeof module !== 'undefined') module.exports = patchSend2;
