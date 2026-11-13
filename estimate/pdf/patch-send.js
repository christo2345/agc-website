// applies the Nov 13 estimate-email change (Chris's wording + the PDF attached) to the 'Send Estimate To Client' script
function patchSend(src, pdf) {
  const rep = (o, n) => { const c = src.split(o).length - 1; if (c !== 1) throw new Error((c ? 'many' : 'not found') + ': ' + o.slice(0, 70)); src = src.split(o).join(n); };
  rep("// Nov 13 (🧾 ESTIMATE BUILDER): when the project has a 🧾 ESTIMATE LINK the draft is the digital estimate email (link button), DATE ESTIMATED is filled if empty, and ⚠️ CHECK FIRST points go in an internal note.",
    "// Nov 13 (🧾 ESTIMATE BUILDER): when the project has a 🧾 ESTIMATE LINK the draft is the estimate email in Chris's wording (Nov 13 edit) with the estimate PDF ATTACHED\n" +
    "// ('AGC <#> - ESTIMATE - <rev>.pdf', drawn from the link's data; no link in the email), DATE ESTIMATED is filled if empty, and ⚠️ CHECK FIRST points go in an internal note.\n" +
    "// An older estimate file on the project is not attached again (the new PDF replaces it). If the PDF cannot be made, the draft is still made and an internal note says to attach it by hand.");
  rep("const c = input.config();\n", "const c = input.config();\n" + pdf.replace(/\s+$/, '') + "\n");
  rep("if (!/^https?:/i.test(url)) continue;\n", "if (!/^https?:/i.test(url)) continue;\nif (est && /estimate/i.test(name)) { replaced.push(name); continue; } // 🧾 the new estimate PDF replaces an older estimate file\n");
  rep("const att = [], skipped = [], badFiles = []; let size = 0;", "const att = [], skipped = [], badFiles = [], replaced = []; let size = 0;");
  const a = src.indexOf("if (est) { // 🧾 the digital estimate email"), b = src.indexOf("const from = emails(c.fromAddress)");
  if (a < 0 || b < a) throw new Error('estimate block not found');
  src = src.slice(0, a) + [
    "let pdfName = '', pdfErr = '', pdfPages = 0;",
    "if (est) { // 🧾 the estimate email, word for word as Chris edited it (Nov 13 2026), with the estimate PDF attached (no link in the email)",
    "const first = S(flat(c.first)[0]).split(/\\s+/)[0] || 'there', proj = S(c.project);",
    "const P = t => '<p style=\"margin-top:0px;margin-bottom:0px\">' + t + '</p>', BL = P('<br>');",
    "html = [P('Hi ' + escH(first) + ','), BL,",
    "P('Your estimate is ready for:'), BL,",
    "P('<strong><span style=\"color:#93c83e\"><span style=\"font-size:17px\">AGC ' + escH(proj) + '</span></span></strong>'), BL,",
    "P('To lock in the work, please reply with your PO name or number and we will book your install date.'), BL,",
    "P('If anything needs to change, just reply here and we will update it right away.'), BL,",
    "P('Thanks!!')].join('');",
    "try { const ED = AGC_PDF.fromLink(est); if (!ED || !ED.n) throw new Error('the estimate link has no data');",
    "const pdf = await AGC_PDF.make(ED, u => globalThis.fetch(u));",
    "if (!pdf.bytes || pdf.bytes.length < 1000) throw new Error('the PDF came out empty');",
    "att.unshift({base64_data: b64(pdf.bytes), filename: pdf.name}); size += pdf.bytes.length; pdfName = pdf.name; pdfPages = pdf.pages;",
    "} catch (e) { pdfErr = S(e && e.message || e).slice(0, 160); console.log('estimate pdf: ' + (e && e.stack || e)); }",
    "}", ""].join('\n') + src.slice(b);
  rep("' · estimate link ' + (est ? 'yes (' + est.length + ' chars)' : 'no')",
    "' · estimate link ' + (est ? 'yes (' + est.length + ' chars)' : 'no') + (est ? ' · PDF ' + (pdfName ? pdfName + ' (' + pdfPages + ' page' + (pdfPages > 1 ? 's' : '') + ')' : 'NOT MADE: ' + pdfErr) : '') + (replaced.length ? ' · older estimate file not attached: ' + replaced.join(', ') : '')");
  rep("// 🧾 the estimate's own check: open points go in an internal note for the PM (clients never see notes)",
    "if (est && pdfErr && cid) { try { await globalThis.fetch(API + '/posts', {method: 'POST', headers: H('MISSIVE_TOKEN'), body: JSON.stringify({posts: {conversation: cid, username: 'AGC Estimate Builder',\n" +
    "notification: {title: '⚠️ Estimate PDF NOT attached', body: pdfErr.slice(0, 120)},\n" +
    "markdown: '⚠️ **The estimate PDF could not be made, so it is NOT attached:** ' + pdfErr + '\\nOpen the 🧾 ESTIMATE LINK on the project, save it as a PDF (it is named for you) and attach it before you send.'}})}); } catch (e) { console.log('pdf note: ' + e); } }\n" +
    "// 🧾 the estimate's own check: open points go in an internal note for the PM (clients never see notes)");
  rep("return (badFiles.length ? '⚠️ FILE NOT ATTACHED: ' + badFiles.join(', ') + ' · ' : '')",
    "return (est && pdfErr ? '⚠️ ESTIMATE PDF NOT ATTACHED (' + pdfErr + ') · ' : '') + (badFiles.length ? '⚠️ FILE NOT ATTACHED: ' + badFiles.join(', ') + ' · ' : '')");
  rep("(est ? ' · 🧾 digital estimate link' : '')", "(pdfName ? ' · 📎 ' + pdfName : '') + (replaced.length ? ' · older estimate file left out: ' + replaced.join(', ') : '')");
  // 🧵 Nov 13 (Chris): the estimate draft goes in the client's own email thread. Thread match 1 = subject has the AGC # (as before);
  // match 2 (estimate drafts only) = the client's most recent thread (last 45 days) whose subject has a word of the project name.
  rep("const hit = ((await jr.json()).conversations || []).filter(", "const convs = ((await jr.json()).conversations || []); let hit = convs.filter(");
  rep("\nif (!hit) continue;", "\nif (!hit && est) { const words = S(c.project).toLowerCase().replace(/^\\s*\\d+\\s*\\/\\s*/, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !/^(install|installs|installation|project|test|delete|with|from|the)$/.test(w));\n" +
    "const since = Date.now() / 1000 - 45 * 86400; if (words.length) hit = convs.filter(cv => cv.messages_count !== 0 && (Number(cv.last_activity_at) || 0) > since && words.some(w => (S(cv.subject) + ' ' + S(cv.latest_message_subject)).toLowerCase().includes(w)))\n" +
    ".sort((a, b) => (Number(b.last_activity_at) || 0) - (Number(a.last_activity_at) || 0))[0]; }\nif (!hit) continue;");
  return src;
}
if (typeof module !== 'undefined') module.exports = patchSend;
