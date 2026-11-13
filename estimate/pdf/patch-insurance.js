// Nov 13 (Chris: "DEVIL DOG INSTALLATIONS: COI - the insurance agent did not react to this email, fix")
// What happened: Rebecca's Nov 12 email "W-9 and ACH" said "COI: to follow". INSURANCE WATCH took the FIRST PDF of any email whose
// text mentions COI, so it filed DDI_W-9_2026.pdf as their COI (the reader rightly rejected it). The real COI came on Nov 13 to
// accounting@, after the daily WATCH run.
// Fix: a W-9 / W-8 / ACH / bank / void cheque / invoice / quote / receipt... file is never taken as a COI; a file named like a COI
// (coi, certif, insur, liab, acord...) wins; text only ("COI attached") counts when the email has exactly one other PDF and does not
// say the COI is still to come. When WATCH adds a real COI, a non-COI file it filed there earlier is taken out of Insurance Document
// PDF, but only when that same file is also in US TAX FORMS or VOID CHECK (nothing is lost).
window.__NOT_COI_SRC = "/(^|[^a-z0-9])w-?[89]([^0-9]|$)|w8ben|(^|[^a-z])tax([^a-z]|$)|(^|[^a-z])ach([^a-z]|$)|bank|void|cheque|direct.?deposit|invoice|(^|[^a-z])inv[\\s_#-]*\\d|quote|estimate|receipt|statement|remit|onboard|(^|[^a-z])agreement([^a-z]|$)|(^|[^a-z])contract([^a-z]|$)|(^|[^a-z])nda([^a-z]|$)|price|rate.?card|brochure|portfolio|resume/i";
window.__COI_LATER_SRC = "/\\b(coi|certificate|insurance)\\b[^.\\n]{0,40}\\b(to follow|will follow|coming|to come|soon|shortly|next week|later)\\b/i";

function patchWatch(src) {
  const rep = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('anchor not found: ' + a.slice(0, 60)); return s.split(a).join(b); };
  src = rep(src, "const COI_TEXT = /insurance|certificate|\\bcoi\\b|liability|additional(ly)? insured|policy/i;",
    "const COI_TEXT = /insurance|certificate|\\bcoi\\b|liability|additional(ly)? insured|policy/i;\n" +
    "// Nov 13 (Devil Dog): a W-9, ACH form, invoice... is never a COI, even when the email mentions the COI ('COI: to follow')\n" +
    "const NOT_COI = " + window.__NOT_COI_SRC + ";\n" +
    "const COI_LATER = " + window.__COI_LATER_SRC + ";");
  src = rep(src, "exp: 'fldVP9kAhoNIyq3mS', pdf: 'fldNTqtWxhTl5a4bX',",
    "exp: 'fldVP9kAhoNIyq3mS', pdf: 'fldNTqtWxhTl5a4bX', tax: 'fldCOUwOIKFbRoN3Y', bank: 'fldF9c4eEN8fcZdcT',");
  src = rep(src, "const a = (m.attachments || []).find(x => /\\.pdf$/i.test(S(x.filename)) && S(x.url) && (COI_FILE.test(S(x.filename)) || COI_TEXT.test(text)));",
    "const pdfA = (m.attachments || []).filter(x => /\\.pdf$/i.test(S(x.filename)) && S(x.url) && !NOT_COI.test(S(x.filename)));\n" +
    "            const a = pdfA.find(x => COI_FILE.test(S(x.filename))) || (COI_TEXT.test(text) && !COI_LATER.test(text) && pdfA.length === 1 ? pdfA[0] : null);");
  src = rep(src, "if (!DRY) await I.updateRecordAsync(ins.id, {[IF.pdf]: [...pdfs.map(p => ({id: p.id})), {url: coi.url, filename: coi.filename}]});",
    "const elsewhere = new Set([...(ins.getCellValue(IF.tax) || []), ...(ins.getCellValue(IF.bank) || [])].map(p => L(p.filename)));\n" +
    "      const wrong = pdfs.filter(p => NOT_COI.test(S(p.filename)) && elsewhere.has(L(p.filename)));\n" +
    "      if (wrong.length) { line.push(today + ' 🧹 ' + wrong.map(p => p.filename).join(', ') + ' taken out of Insurance Document PDF: not a COI (still in US TAX FORMS / VOID CHECK).'); out.push('🧹 ' + label + ': ' + wrong.map(p => p.filename).join(', ') + ' taken out (not a COI)'); }\n" +
    "      const cu = (() => { try { return new URL(coi.url).href; } catch (e) { return coi.url; } })();\n" +
    "      if (!DRY) await I.updateRecordAsync(ins.id, {[IF.pdf]: [...pdfs.filter(p => !wrong.includes(p)).map(p => ({id: p.id})), {url: cu, filename: coi.filename}]});");
  return src;
}

function patchIntake(src) {
  const rep = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('anchor not found: ' + a.slice(0, 60)); return s.split(a).join(b); };
  src = rep(src, "let files = all.filter(f => !sig(f) && __INS_FILE.test(T(f.filename)) && (isPdf(f) || isImg(f)));\n  if (!files.length && __INS_TEXT.test(text)) files = all.filter(f => !sig(f) && (isPdf(f) || (gv && isImg(f))));",
    "// Nov 13 (Devil Dog): a W-9, ACH form, invoice... is never a COI; text only ('COI attached') counts with exactly one other PDF and not 'COI to follow'\n" +
    "  const __NOT_COI = " + window.__NOT_COI_SRC + ", __COI_LATER = " + window.__COI_LATER_SRC + ";\n" +
    "  const okName = f => !__NOT_COI.test(T(f.filename));\n" +
    "  let files = all.filter(f => !sig(f) && okName(f) && __INS_FILE.test(T(f.filename)) && (isPdf(f) || isImg(f)));\n" +
    "  if (!files.length && __INS_TEXT.test(text) && !__COI_LATER.test(text)) { const one = all.filter(f => !sig(f) && okName(f) && (isPdf(f) || (gv && isImg(f)))); if (one.length === 1 || gv) files = one; }");
  return src;
}

// applies the right patch to the open Monaco script editor; returns a short report
window.__applyInsPatch = function (which) {
  const m = monaco.editor.getModels().find(x => /INSURANCE AGENT · WATCH|INSURANCE INTAKE/.test(x.getValue())) || monaco.editor.getModels()[0];
  const before = m.getValue();
  if (/Nov 13 \(Devil Dog\)/.test(before)) return 'already patched';
  const after = which === 'watch' ? patchWatch(before) : patchIntake(before);
  m.pushEditOperations([], [{range: m.getFullModelRange(), text: after}], () => null);
  return 'patched ' + which + ': ' + before.length + ' -> ' + m.getValue().length;
};
window.__insPatchLoaded = true;
if (typeof module !== 'undefined') module.exports = {patchWatch, patchIntake};
