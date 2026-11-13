// Nov 13 (Chris): moving a project back to ✨🌟 NEW PROJECT 🌟✨ clears 🧾 ESTIMATE LINK and 🧾 ESTIMATE CHECK.
// The last rev number is kept in the check field, so the next estimate carries on the numbering (rev 3 after rev 2) and never reuses a PDF name.
function patchBuilder3(src) {
  const o = "if (v(F.test) && !force) return '⏭️ test project";
  if (src.split(o).length !== 2) throw new Error('anchor not found');
  return src.split(o).join("if (/NEW PROJECT/i.test(status) && !force) { const lastRev = Number((str(F.check).match(/rev (\\d+)/) || [])[1]) || 0;\n" +
    "    if (str(F.link) || (str(F.check) && !/^🧹/.test(str(F.check)))) { await T.updateRecordAsync(rec.id, {[F.link]: null, [F.check]: lastRev ? '🧹 Estimate cleared: the project went back to NEW PROJECT · last rev ' + lastRev : null}); return '🧹 status back to NEW PROJECT: estimate link and check cleared'; }\n" +
    "    return '⏭️ new project, no estimate yet'; }\n  " + o);
}
if (typeof module !== 'undefined') module.exports = patchBuilder3;
