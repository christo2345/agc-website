// Nov 13 (Chris: "devil dog, i dont see any comments in missive about what was done")
// The READER never posted its verdict in Missive, and WATCH posted nothing when it found a COI in an email.
// Now: whoever puts a COI from an email on the installer (📎 INSURANCE INTAKE or 🛡️ INSURANCE WATCH) writes a row
// 'INSURANCE FILE | <file name>' (note: 'conv <conversation id>') in 🔁 PROCESSED MESSAGES; WATCH also posts a card in that thread.
// The 🛡️ INSURANCE READER then posts its verdict card (APPROVED, or the fix for the installer) in that same thread.
const ROW = "const PT = base.getTable('tblBY5uiFLoDMsxtq');";

function patchWatch(src) {
  const rep = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('anchor not found: ' + a.slice(0, 70)); return s.split(a).join(b); };
  src = rep(src, "coi = {url: S(a.url), filename: S(a.filename), when: Number(m.delivered_at) || 0}; break;",
    "coi = {url: S(a.url), filename: S(a.filename), when: Number(m.delivered_at) || 0, conv: S(cv.id)}; break;");
  const a = "if (!DRY) await I.updateRecordAsync(ins.id, {[IF.pdf]: [...pdfs.filter(p => !wrong.includes(p)).map(p => ({id: p.id})), {url: cu, filename: coi.filename}]});";
  src = rep(src, a, a + "\n" +
    "      // 💬 Nov 13: a card in the email thread + a row so the 🛡️ INSURANCE READER posts its verdict in the same thread\n" +
    "      if (!DRY && coi.conv) { try { await base.getTable('tblBY5uiFLoDMsxtq').createRecordAsync({fldDvmVpPi0NUxlS7: 'INSURANCE FILE | ' + coi.filename, fldjEqafcLZWzFXK6: 'INSURANCE FILE', fldcEAklRbl5kO9Al: (company + ' · conv ' + coi.conv).slice(0, 200)});\n" +
    "        calls++; await fetch(API + '/posts', {method: 'POST', headers: H('MISSIVE_TOKEN'), body: JSON.stringify({posts: {conversation: coi.conv, username: 'AGC Insurance', notification: {title: 'Insurance · ' + company, body: 'COI found, reading it now'},\n" +
    "          attachments: [{author_name: '🛡️ INSURANCE WATCH', title: 'COI found in this email for ' + company + ', reading it now', color: '#2ecc71', markdown: '⏳ ' + coi.filename + ' added to Insurance Document PDF, the reader is checking it (the result is posted here)' + (wrong.length ? '\\n🧹 ' + wrong.map(p => p.filename).join(', ') + ' taken out of Insurance Document PDF (not a COI)' : '')}]}})}); }\n" +
    "        catch (e) { console.log('watch card: ' + e); } }");
  return src;
}

function patchIntake(src) {
  const a = "  await I.updateRecordAsync(ins.id, upd);\n  // small card in the thread";
  if (src.split(a).length !== 2) throw new Error('anchor not found (intake)');
  return src.split(a).join("  await I.updateRecordAsync(ins.id, upd);\n" +
    "  // 💬 Nov 13: a row per new file so the 🛡️ INSURANCE READER posts its verdict in this thread\n" +
    "  for (const f of add) { try { await base.getTable('tblBY5uiFLoDMsxtq').createRecordAsync({fldDvmVpPi0NUxlS7: 'INSURANCE FILE | ' + T(f.filename), fldjEqafcLZWzFXK6: 'INSURANCE FILE', fldcEAklRbl5kO9Al: (company + ' · conv ' + cid).slice(0, 200)}); } catch (e) { console.log('file row: ' + e); } }\n" +
    "  // small card in the thread");
}

function patchReader(src) {
  const a = "    status = (found && named === 'additional_insured' ? '✅ ' : '⚠️ ') + company + ': ' + said.join(' · ') + tail;\n";
  if (src.split(a).length !== 2) throw new Error('anchor not found (reader)');
  return src.split(a).join(a +
    "    // 💬 Nov 13 (Chris: 'I don't see any comments in Missive about what was done'): the verdict goes in the email thread the COI came from\n" +
    "    // (row 'INSURANCE FILE | <file>' written by the 📎 INSURANCE INTAKE or the 🛡️ INSURANCE WATCH). A file added by hand has no thread: nothing posted.\n" +
    "    try {\n" +
    "      const names = new Set(S(c.files).split(/\\)\\s*,\\s*/).map(x => x.replace(/\\s*\\([^()]*\\)?\\s*$/, '').trim().toLowerCase()).filter(Boolean));\n" +
    "      const PT = base.getTable('tblBY5uiFLoDMsxtq'); const pq = await PT.selectRecordsAsync({fields: ['fldDvmVpPi0NUxlS7', 'fldcEAklRbl5kO9Al', 'fld8QsVEcnyf3jLaa']});\n" +
    "      const hit = pq.records.filter(x => { const k = x.getCellValueAsString('fldDvmVpPi0NUxlS7'); return /^INSURANCE FILE \\| /.test(k) && names.has(k.slice(17).trim().toLowerCase()); })\n" +
    "        .sort((p, q) => (Number(q.getCellValue('fld8QsVEcnyf3jLaa')) || 0) - (Number(p.getCellValue('fld8QsVEcnyf3jLaa')) || 0))[0];\n" +
    "      const conv = hit ? S((hit.getCellValueAsString('fldcEAklRbl5kO9Al').match(/conv ([0-9a-f-]{36})/i) || [])[1]) : '';\n" +
    "      if (conv) {\n" +
    "        const ok = found && named === 'additional_insured', co = company.split(' - ')[0];\n" +
    "        const md = [(ok ? '✅ ' : '⚠️ ') + said.join(' · '), meta ? '▫️ ' + meta : '', S(c.notes) && S(c.notes) !== '-' ? '▫️ ' + NODASH(c.notes).slice(0, 240) : '', ok ? '' : '⏳ To fix (for the installer): ' + msg.slice(0, 300)].filter(Boolean).join('\\n');\n" +
    "        const pr = await fetch('https://public.missiveapp.com/v1/posts', {method: 'POST', headers: {'Authorization': 'Bearer ' + input.secret('MISSIVE_TOKEN'), 'Content-Type': 'application/json'},\n" +
    "          body: JSON.stringify({posts: {conversation: conv, username: 'AGC Insurance', notification: {title: 'Insurance · ' + co, body: ok ? 'COI approved' : 'COI needs a fix'},\n" +
    "            attachments: [{author_name: '🛡️ INSURANCE READER', title: (ok ? 'COI APPROVED · ' : 'COI checked, not approved yet · ') + co, color: ok ? '#2ecc71' : '#f1c40f', markdown: md}]}})});\n" +
    "        status += pr.ok ? ' · 💬 result posted in Missive' : ' · ⚠️ Missive card not posted (' + pr.status + ')';\n" +
    "      }\n" +
    "    } catch (e) { console.log('missive card: ' + e); }\n");
}

window.__applyIns3 = function (which) {
  const m = monaco.editor.getModels()[0];
  const before = m.getValue();
  if (/💬 Nov 13/.test(before)) return 'already patched';
  const after = which === 'watch' ? patchWatch(before) : which === 'intake' ? patchIntake(before) : patchReader(before);
  m.pushEditOperations([], [{range: m.getFullModelRange(), text: after}], () => null);
  return 'patched ' + which + ': ' + before.length + ' -> ' + m.getValue().length;
};
window.__ins3Loaded = true;
if (typeof module !== 'undefined') module.exports = {patchWatch, patchIntake, patchReader};
