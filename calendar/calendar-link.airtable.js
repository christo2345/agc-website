// 📅 ADD TO MY CALENDAR (Chris, Nov 13 2026): the link for the Installation Request email. It opens the AGC calendar page
// (GitHub Pages, calendar/index.html) with the job in the link itself (#d=...): no prices, nothing stored on GitHub.
// Time: a clock time = that time + 2 hours; DURING STORE HOURS = the store's hours that day; BEFORE STORE OPENING = the 2 hours
// before it opens; AFTER STORE HOURS = 2 hours from closing; anything else (TBD, IN THE MORNING, OUTSIDE OF STORE HOURS...) = an
// all-day event with that text. No DATE SCHEDULED = no link. Never blocks the email: any error = no link.
const __calLink = async (recordId) => {
  const T = v => (v == null ? '' : String(v)).trim();
  const P = base.getTable('tblziZ2NmNH2m3HfJ');
  const pr = await P.selectRecordAsync(recordId, {fields: ['fldun3cFC3XoZgKbq', 'fldX3JuLARQL4lEek', 'fldA1kSKZSDYL7mpp', 'fldPnFe4t9nNsf2Nd', 'fld2jPpuCG3ooais9', 'fldMIMVwjCexAyBXv', 'fldXGVM8F7OIX0UFj', 'fldrb3xNJ25Q9pe3t', 'fldfqVZWxYyRJjKas', 'fldpptEmODCPnnZHv']});
  if (!pr) return '';
  const d = T(pr.getCellValue('fldA1kSKZSDYL7mpp')).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const flat = v => (Array.isArray(v) ? v.flat(3) : [v]).map(x => x && typeof x === 'object' ? T(x.name || x.value || x.email) : T(x)).filter(Boolean);
  const plain = md => T(md).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/[*_\\]/g, '').replace(/\s+/g, ' ').trim();
  const sel = T(pr.getCellValueAsString('fldPnFe4t9nNsf2Nd')), txt = T(pr.getCellValue('fld2jPpuCG3ooais9'));
  const when = sel || txt;
  const clock = t => { const m = T(t).match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b/i); if (!m) return null; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return {h, m: +(m[2] || 0)}; };
  const hhmm = t => (t.h < 10 ? '0' : '') + t.h + ':' + (t.m < 10 ? '0' : '') + t.m;
  // the stores (first one sets the hours)
  const sids = (pr.getCellValue('fldXGVM8F7OIX0UFj') || []).map(x => x.id);
  const loc = []; let hours = '';
  if (sids.length) { const sq = await base.getTable('tblmO5352IqyYu7Pd').selectRecordsAsync({fields: ['fldP5w2HM9xtsWGDi', 'fldtZ6JaEUKZpzFrA', 'fldteqlH31FVA5dMd', 'fldiPHjhEMgOpIdYi'], recordIds: sids});
    for (const id of sids) { const r = sq.getRecord(id); if (!r) continue; loc.push({n: T(r.getCellValueAsString('fldP5w2HM9xtsWGDi')), a: plain(r.getCellValue('fldtZ6JaEUKZpzFrA')), p: T(r.getCellValueAsString('fldteqlH31FVA5dMd'))});
      if (!hours) hours = T(r.getCellValue('fldiPHjhEMgOpIdYi')); } }
  // that weekday's opening hours, e.g. 'Monday 10 AM–9 PM' / 'Sunday - 12:00–6 PM'
  const dayHours = () => {
    const wd = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {timeZone: 'UTC', weekday: 'long'});
    const line = hours.split('\n').find(l => new RegExp('^\\s*' + wd + '\\b', 'i').test(l)); if (!line) return null;
    if (/closed|24 hours/i.test(line)) return null;
    const m = line.replace(/^\s*\w+\s*[-:]?\s*/, '').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i); if (!m) return null;
    const close = {h: +m[4] % 12 + (/pm/i.test(m[6]) ? 12 : 0), m: +(m[5] || 0)};
    let oh = +m[1] % 12; const om = +(m[2] || 0);
    if (m[3]) oh += /pm/i.test(m[3]) ? 12 : 0; else if (/pm/i.test(m[6]) && +m[1] === 12) oh = 12; else if (/pm/i.test(m[6]) && oh + 12 < close.h) oh += 0;
    const open = {h: oh, m: om};
    return open.h * 60 + open.m < close.h * 60 + close.m ? {open, close} : null;
  };
  const add = (t, min) => { const x = Math.max(0, Math.min(23 * 60 + 59, t.h * 60 + t.m + min)); return {h: Math.floor(x / 60), m: x % 60}; };
  let s = null, e = null; const c = clock(when);
  if (c) { s = c; e = add(c, 120); }
  else if (/DURING STORE HOURS/i.test(when)) { const dh = dayHours(); if (dh) { s = dh.open; e = dh.close; } }
  else if (/BEFORE STORE OPENING/i.test(when)) { const dh = dayHours(); if (dh) { s = add(dh.open, -120); e = dh.open; } }
  else if (/AFTER STORE HOURS/i.test(when)) { const dh = dayHours(); if (dh) { s = dh.close; e = add(dh.close, 120); } }
  const D = {n: T(pr.getCellValueAsString('fldun3cFC3XoZgKbq')), t: T(pr.getCellValueAsString('fldX3JuLARQL4lEek')), d: d, w: when};
  if (s) { D.s = hhmm(s); D.e = hhmm(e); }
  if (loc.length) D.loc = loc.slice(0, 6);
  const oc = T(pr.getCellValue('fldMIMVwjCexAyBXv')).replace(/\s+/g, ' '); if (oc) D.oc = oc.slice(0, 200);
  const pmN = flat(pr.getCellValue('fldrb3xNJ25Q9pe3t'))[0] || '';
  D.pm = {nm: pmN, em: flat(pr.getCellValue('fldfqVZWxYyRJjKas'))[0] || 'projects@americangraphiccontractors.com', ph: flat(pr.getCellValue('fldpptEmODCPnnZHv'))[0] || '1 (877) 395-7435'};
  // base64url of the UTF-8 JSON (no btoa in Airtable scripts)
  const u8 = []; for (const ch of JSON.stringify(D)) { let cp = ch.codePointAt(0);
    if (cp < 128) u8.push(cp); else if (cp < 2048) u8.push(192 | cp >> 6, 128 | cp & 63); else if (cp < 65536) u8.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63); else u8.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63); }
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let b = '';
  for (let i = 0; i < u8.length; i += 3) { const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0);
    b += A[n >> 18 & 63] + A[n >> 12 & 63] + (i + 1 < u8.length ? A[n >> 6 & 63] : '') + (i + 2 < u8.length ? A[n & 63] : ''); }
  return 'https://christo2345.github.io/agc-website/calendar/#d=' + b;
};
