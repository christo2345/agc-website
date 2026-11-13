// Nov 13 for the '🧾 ESTIMATE BUILDER' script:
// 1) moving the project back to 📄 READY FOR ESTIMATE 📄 makes a NEW estimate (new rev, new link, so a new PDF when it is sent)
// 2) a test project builds when 🧾 BUILD ESTIMATE is ticked   3) no tax line (AGC charges no tax)
// The status the estimate was last seen in is kept at the end of 🧾 ESTIMATE CHECK (' · st R' ready, 'A' awaiting approval, 'O' other).
function patchBuilder(src) {
  const has = o => src.split(o).length - 1;
  const rep = (o, n) => { const c = has(o); if (c !== 1) throw new Error((c ? 'many' : 'not found') + ': ' + o.slice(0, 70)); src = src.split(o).join(n); };
  // 2) test projects
  const t1 = "if (v(F.test)) { await untick(); return '⏭️ test project'; }";
  if (has(t1) === 1) rep(t1, "if (v(F.test) && !force) return '⏭️ test project (tick 🧾 BUILD ESTIMATE to build it anyway)'; // a test project builds only on purpose");
  // 3) no tax line
  src = src.split('\n').filter(l => !/^\s*(P\.tax\s*=|if \(.*\) P\.tax\s*=)/.test(l)).join('\n');
  // 1) back to READY FOR ESTIMATE = a new estimate
  rep("if (!force && prevSig === sig && str(F.link)) return '⏭️ no change since rev ' + prevRev;",
    "const stNow = /READY FOR ESTIMATE/i.test(status) ? 'R' : /AWAITING APPROVAL/i.test(status) ? 'A' : 'O', prevSt = (prev.match(/ · st ([RAO])\\s*$/) || [])[1] || '';\n" +
    "  const reset = stNow === 'R' && prevSt !== 'R' && !!str(F.link); // moved back to READY FOR ESTIMATE (Chris, Nov 13): make a new estimate\n" +
    "  if (!force && !reset && prevSig === sig && str(F.link)) { if (prevSt !== stNow) await T.updateRecordAsync(rec.id, {[F.check]: prev.replace(/ · st [RAO]\\s*$/, '') + ' · st ' + stNow}); return '⏭️ no change since rev ' + prevRev; }");
  rep("const rev = prevSig === sig ? Math.max(prevRev, 1) : prevRev + 1;", "const rev = prevSig === sig && !reset ? Math.max(prevRev, 1) : prevRev + 1;");
  rep("(force ? 'built on request' : 'built by itself (' + status + ')') + ' · sig ' + sig", "(force ? 'built on request' : reset ? 'new estimate: status back to READY FOR ESTIMATE' : 'built by itself (' + status + ')') + ' · sig ' + sig + ' · st ' + stNow");
  return src;
}
if (typeof module !== 'undefined') module.exports = patchBuilder;
