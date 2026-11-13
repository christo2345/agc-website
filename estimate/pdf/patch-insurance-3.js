// Nov 13 (Chris: "devil dog, i dont see any comments in missive about what was done")
// The READER never posted its verdict in Missive, and WATCH posted nothing when it found a COI in an email.
// Now: whoever puts a COI from an email on the installer (📎 INSURANCE INTAKE or 🛡️ INSURANCE WATCH) writes a row
// 'INSURANCE FILE | <file name>' (note: 'conv <conversation id>') in 🔁 PROCESSED MESSAGES; WATCH also posts a card in that thread.
// The 🛡️ INSURANCE READER then posts its verdict card (APPROVED, or the fix for the installer) in that same thread.

// ✍️ Nov 13 (Chris: "we need to send an acknowledgement email to the partner as well, a draft based on the insurance agent findings"):
// a reply DRAFT in the partner's thread, as the PM of their next open job (else Chris), never sent. APPROVED = thank you + approved + on file
// (+ a workers comp ask when the reader saw none); not approved = the one fix. Only when the partner wrote last and nobody started a reply.
const DRAFT = [
"        try {",
"          const H0 = k => ({'Authorization': 'Bearer ' + input.secret(k), 'Content-Type': 'application/json'});",
"          const API0 = 'https://public.missiveapp.com/v1', AGCR = /@(americangraphiccontractors|canadiangraphiccontractors)\\.com$/i;",
"          const g = async p => { const rr = await fetch(API0 + p, {headers: H0('MISSIVE_TOKEN')}); return rr.ok ? rr.json() : {}; };",
"          const ms = ((await g('/conversations/' + encodeURIComponent(conv) + '/messages?limit=10')).messages || []).filter(m => m && !m.draft).sort((p, q) => (Number(q.delivered_at) || 0) - (Number(p.delivered_at) || 0));",
"          const last = ms[0] && !AGCR.test(S(ms[0].from_field && ms[0].from_field.address).toLowerCase()) ? ms[0] : null;",
"          const since = Number(last && last.delivered_at) || 0;",
"          const started = ((await g('/conversations/' + encodeURIComponent(conv) + '/drafts')).drafts || []).some(d => (Number(d.created_at) || 0) >= since - 5);",
"          if (!last) status += ' · ✍️ no draft (AGC already answered in that thread)';",
"          else if (started) status += ' · ✍️ no draft (a reply is already started in that thread)';",
"          else {",
"            const PQ = await base.getTable('tblziZ2NmNH2m3HfJ').selectRecordsAsync({fields: ['fldun3cFC3XoZgKbq', 'fld2vCkGYGAFZg7vY', 'fldQOn7eLSyWPy8u5', 'fldA1kSKZSDYL7mpp', 'fldrb3xNJ25Q9pe3t', 'fld8AMx5M1isDckxq']});",
"            const jobs = PQ.records.filter(x => [...(x.getCellValue('fld2vCkGYGAFZg7vY') || []), ...(x.getCellValue('fldQOn7eLSyWPy8u5') || [])].some(y => y.id === r.id) && !/COMPLETE|INVOICE|PAID|NO CHARGE|CANCEL|TEST|MASTER/i.test(x.getCellValueAsString('fld8AMx5M1isDckxq')))",
"              .sort((p, q) => (S(p.getCellValue('fldA1kSKZSDYL7mpp')) || '9999').localeCompare(S(q.getCellValue('fldA1kSKZSDYL7mpp')) || '9999'));",
"            const PMK = {recGNwRLs9ED0r8oU: ['MISSIVE_TOKEN_ROBERT', 'Robert'], recTRsdKUVVueF7UI: ['MISSIVE_TOKEN_RANDY', 'Randy']};",
"            const pmRec = jobs.flatMap(x => x.getCellValue('fldrb3xNJ25Q9pe3t') || []).find(y => PMK[y.id]);",
"            let [key, who] = pmRec ? PMK[pmRec.id] : ['MISSIVE_TOKEN', 'Chris'];",
"            const nums = [...new Set(jobs.map(x => S(x.getCellValueAsString('fldun3cFC3XoZgKbq'))).filter(Boolean))].slice(0, 4);",
"            const first = S(last.from_field && last.from_field.name).replace(/^.*,\\s*/, '').split(/\\s+/)[0] || 'there';",
"            const longD = d => { try { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'}); } catch (e) { return d; } };",
"            const expD = S(f[IF.exp] || r.getCellValue(IF.exp)).slice(0, 10);",
"            const paras = ok ? ['Hi ' + first + ',', 'Thank you for sending your certificate of insurance. We reviewed it and it is approved: American Graphic Contractors LLC is named as additional insured' + (expD ? ' and the policy is valid until ' + longD(expD) : '') + '. It is now on file' + (nums.length ? ' for AGC ' + nums.join(', ') : '') + '.']",
"              : ['Hi ' + first + ',', 'Thank you for sending your certificate of insurance. We reviewed it and need one change before we can approve it. ' + msg, 'Just reply to this email with the updated PDF and we will update our records.'];",
"            if (ok && ((!isDate(S(c.workers_comp_expiry).slice(0, 10)) && !isDate(S(r.getCellValue(IF.wcb)).slice(0, 10))) || /workers comp(ensation)?\\b[^.]{0,80}\\b(not shown|not listed|not included|missing|none)|no workers comp|without workers comp/i.test(S(c.notes)))) paras.push('When you get a chance, could you also send us your workers compensation certificate (or your exemption)?');",
"            const esc = t => NODASH(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
"            const fj = await g('/messages/' + encodeURIComponent(last.id)); const full = Array.isArray(fj.messages) ? fj.messages[0] : fj.messages;",
"            const refs = full ? [...new Set([...(Array.isArray(full.references) ? full.references : []), S(full.email_message_id)].map(S).filter(Boolean))].slice(-20) : [];",
"            const sj = S(full && full.subject) || S(last.subject) || 'Certificate of insurance';",
"            const agcAddr = [...(last.to_fields || []), ...(last.cc_fields || [])].map(x => S(x && x.address).toLowerCase()).find(a => AGCR.test(a)) || 'projects@americangraphiccontractors.com';",
"            const d = {subject: /^re\\s*:/i.test(sj) ? sj : 'Re: ' + sj, body: paras.map(p => '<p>' + esc(p) + '</p>').join('<p><br></p>'), to_fields: [{address: S(last.from_field.address), name: S(last.from_field.name)}],",
"              from_field: {address: agcAddr, name: 'American Graphic Contractors'}, conversation: conv, add_default_signature: true};",
"            if (refs.length) d.references = refs;",
"            let dr = await fetch(API0 + '/drafts', {method: 'POST', headers: H0(key), body: JSON.stringify({drafts: d})});",
"            if (!dr.ok && key !== 'MISSIVE_TOKEN') { key = 'MISSIVE_TOKEN'; who = 'Chris'; dr = await fetch(API0 + '/drafts', {method: 'POST', headers: H0(key), body: JSON.stringify({drafts: d})}); }",
"            if (dr.ok) {",
"              const nowI = new Date().toISOString();",
"              try { await base.getTable('tbl6IH5OrnyW9wghu').createRecordAsync({fldkTAm7JwxZdl5tK: ('INSURANCE · ' + who + ' · ' + d.subject).slice(0, 200), fldUxF5VKXqIVtn59: {name: '🛡️ INSURANCE'}, fldEa8CKL7pBnXvfX: {name: who},",
"                fldcLyyv9rUqt9pSF: {name: '⏳ WAITING'}, fldYM8v8UuvWKgtT5: NODASH(paras.join('\\n\\n')), fldlpq9CZB1Q4MHat: (d.subject + (nums.length ? ' · AGC ' + nums.join(', ') : '')).slice(0, 250), fldXiQNJA353BjPVu: conv,",
"                fldOewe7vMQhYIKy5: 'https://mail.missiveapp.com/#inbox/conversations/' + conv, fldOgZKXI5cZoPK0W: S(last.from_field.address), fldU5AstRLFdKuh6X: nowI}); } catch (e) { console.log('draft log: ' + e); }",
"              const r2 = await I.selectRecordAsync(r.id, {fields: [IF.check]}); const ln = today + ' ✍️ ' + (ok ? 'acknowledgement' : 'fix request') + ' draft to ' + S(last.from_field.address) + ' as ' + who + ' in the email thread (not sent).';",
"              const up = {[IF.check]: (S(r2 && r2.getCellValue(IF.check)) ? S(r2.getCellValue(IF.check)) + '\\n' : '') + ln}; if (!ok) up['fldtDtsO1ViuZ2tGa'] = nowI;",
"              await I.updateRecordAsync(r.id, up);",
"              status += ' · ✍️ ' + (ok ? 'acknowledgement' : 'fix request') + ' draft as ' + who;",
"            } else status += ' · ⚠️ draft failed (' + dr.status + ')';",
"          }",
"        } catch (e) { console.log('ack draft: ' + e); status += ' · ⚠️ draft error'; }",
""].map(l => l + "\n").join("");

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
    DRAFT +
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
