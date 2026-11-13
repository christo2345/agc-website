// Nov 13 (Chris: 'BUILD ESTIMATE is defaulting to checked'): the box is unticked even when a run stops with an error
function patchBuilder2(src) {
  const o = "try { status = await main(); } catch (e) { status = '❌ ' + S(e && e.message || e); console.log(e && e.stack || e); }";
  if (src.split(o).length !== 2) throw new Error('anchor not found');
  return src.split(o).join("try { status = await main(); } catch (e) { status = '❌ ' + S(e && e.message || e); console.log(e && e.stack || e); }\n" +
    "if (status.startsWith('❌')) { try { const rid = S(input.config().recordId); if (rid) await base.getTable('tblziZ2NmNH2m3HfJ').updateRecordAsync(rid, {fldFvsBcoCQpC7Om0: false}); } catch (e2) { console.log('untick: ' + e2); } } // 🧾 BUILD ESTIMATE never stays ticked");
}
if (typeof module !== 'undefined') module.exports = patchBuilder2;
