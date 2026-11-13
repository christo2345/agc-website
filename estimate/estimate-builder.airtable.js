// 🧾 ESTIMATE BUILDER · Airtable automation script (reference copy; the live copy is in Airtable).
// Builds the project's digital estimate link (AGC website theme, GitHub Pages) from the project's own
// SERVICE / DETAILS / PRICE 1-5, client, locations, currency and PM, and writes 🧾 ESTIMATE LINK + 🧾 ESTIMATE CHECK.
// Runs when a service, detail, price, client, location or status changes, and when 🧾 BUILD ESTIMATE is ticked.
// Builds by itself only for 📄 READY FOR ESTIMATE 📄 / 🕝 AWAITING APPROVAL 🕝 (any status when the box is ticked).
// Never touches PRICE / BUDGET, never sends or drafts anything, never ticks any box but unticks 🧾 BUILD ESTIMATE.
// No AI credits. The estimate travels inside the link (#d=...), so nothing about a client or a price is stored on GitHub.
const PAGE = 'https://christo2345.github.io/agc-website/estimate/';
const TBL = 'tblziZ2NmNH2m3HfJ';
const F = {
  name: 'fldX3JuLARQL4lEek', agc: 'fldun3cFC3XoZgKbq', status: 'fld8AMx5M1isDckxq', test: 'fldtit312xKKboIHi',
  svc: ['fldXp7bRmV8qhbHJH', 'fldFltPHc3lvGoevd', 'fldigNkY7E1Qg0Boy', 'fldKUVcfKmR2pG92S', 'fldPW8wPv5Wb6QGO6'],
  det: ['fldFxz9bwE8VWIFXd', 'flde3Se6Ora7aIE02', 'fldfhDsZW2ES8baXI', 'fldhDzla1CoiYzDfl', 'fldcoahmObooC1xad'],
  price: ['fldqiMVIQvbD4q4i6', 'fldAUjIqAoYNjbBto', 'fldxDVHBrzJcEKwSt', 'fldBDNgZS49xljTSB', 'fldWltwp6ZKeoQJe1'],
  client: 'fldYIsVYN4DYeFKqD', clientEmail: 'fldJFGiZPQGFTXGue', storeName: 'fldX01rRv3O4xyjFR', storeAddr: 'fld8xU1e3NiYz61xt',
  cur: 'fldp7LXcMCmtlBLnH', totalCost: 'fldvVDQ2SwnnjCcPh', totalBudget: 'fld6QwDlpronKay94', sugRetail: 'fldloo7xj9PrkI1BT',
  pm: 'fldrb3xNJ25Q9pe3t', pmEmail: 'fldfqVZWxYyRJjKas', pmPhone: 'fldpptEmODCPnnZHv', sched: 'fldA1kSKZSDYL7mpp',
  installer: 'fld2vCkGYGAFZg7vY', mapKey: 'fldvlvop3czecccec',
  link: 'fld10LclUCuuSwCxJ', check: 'fldZw2ol2GsJ9798L', build: 'fldFvsBcoCQpC7Om0'
};
const HANDS_OFF = ['17329', '17334', '19043', '19072'];
const S = v => (v == null ? '' : String(v)).trim();
const flat = v => { const o = []; const w = x => { if (x == null) return; if (Array.isArray(x)) x.forEach(w); else if (typeof x === 'object') { if ('valuesByLinkedRecordId' in x) Object.values(x.valuesByLinkedRecordId).forEach(w); else w(x.name != null ? x.name : (x.value != null ? x.value : x.email)); } else o.push(String(x)); }; w(v); return o.map(S).filter(Boolean); };
const NODASH = t => S(t).replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2').replace(/\s*[\u2013\u2014]\s*/g, ', ');
const bullets = t => S(t).replace(/\r/g, '').split('\n').map(l => NODASH(l.replace(/^\s*([-*•·]|\d+[.)])\s+/, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').replace(/^#+\s*/, ''))).filter(l => l.length > 1);
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
// UTF-8 + base64url without relying on btoa / TextEncoder
const utf8 = s => { const o = []; for (const ch of s) { let c = ch.codePointAt(0);
  if (c < 0x80) o.push(c); else if (c < 0x800) o.push(0xc0 | c >> 6, 0x80 | c & 63);
  else if (c < 0x10000) o.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
  else o.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63); } return o; };
const b64url = bytes => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let o = '';
  for (let i = 0; i < bytes.length; i += 3) { const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    o += A[n >> 18 & 63] + A[n >> 12 & 63] + (i + 1 < bytes.length ? A[n >> 6 & 63] : '') + (i + 2 < bytes.length ? A[n & 63] : ''); } return o; };
// SHA-256 (for the check code and the change signature)
const sha256 = msg => { const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b = utf8(msg), l = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0); for (let i = 7; i >= 0; i--) b.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]; const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < b.length; o += 64) { const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) { const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0; }
    H = H.map((x, i) => (x + [a, bb, c, d, e, f, g, h][i]) | 0); }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join(''); };
const ymd = d => { const p = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Edmonton', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(d); const g = t => p.find(x => x.type === t).value; return g('year') + '-' + g('month') + '-' + g('day'); };

async function main() {
  const {recordId} = input.config();
  const T = base.getTable(TBL);
  const ids = [...new Set(Object.values(F).flat())];
  const rec = await T.selectRecordAsync(recordId, {fields: ids});
  if (!rec) return '⏭️ project not found';
  const v = f => rec.getCellValue(f), str = f => S(rec.getCellValueAsString(f));
  const agc = S(v(F.agc)), status = str(F.status), force = !!v(F.build);
  const untick = async () => { if (force) await T.updateRecordAsync(rec.id, {[F.build]: false}); };
  if (HANDS_OFF.includes(agc)) { await untick(); return '⏭️ AGC ' + agc + ' is hands-off'; }
  if (v(F.test) && !force) return '⏭️ test project (tick 🧾 BUILD ESTIMATE to build it anyway)'; // a test project builds only on purpose
  if (!force && !/READY FOR ESTIMATE|AWAITING APPROVAL/i.test(status)) return '⏭️ status ' + (status || 'empty') + ' (tick 🧾 BUILD ESTIMATE to build anyway)';

  const warn = [], ok = [], info = [];
  // lines
  const lines = []; let sum = 0, priced = 0;
  const installers = flat(v(F.installer)).map(x => x.toLowerCase()).filter(x => x.length > 3);
  for (let i = 0; i < 5; i++) {
    const svc = flat(v(F.svc[i])).join(' + '), det = bullets(str(F.det[i])), pr = Number(v(F.price[i])) || 0;
    if (!svc && !det.length && !pr) continue;
    const isInfo = !pr && (/additional\s+info|terms|notes?$/i.test(svc) || !svc);
    if (pr) { priced++; sum += pr; }
    if (!pr && !isInfo) warn.push('line ' + (i + 1) + ' (' + svc + ') has no PRICE ' + (i + 1) + ': shown without an amount');
    if (pr && !svc) warn.push('line ' + (i + 1) + ' has a price but no PRODUCT / SERVICE ' + (i + 1));
    if (pr && !det.length) warn.push('line ' + (i + 1) + ' (' + svc + ') has no DETAILS ' + (i + 1));
    const txt = det.join(' ').toLowerCase(); const hit = installers.find(n => txt.includes(n));
    if (hit) warn.push('line ' + (i + 1) + ' names the installer (' + hit + '): installer names never go to the client');
    if (/\b(budget|profit|margin|markup|installer\s+(rate|cost|price))\b/i.test(txt)) warn.push('line ' + (i + 1) + ' mentions budget / profit / installer cost: check before it goes to the client');
    lines.push(pr ? {s: svc, d: det, a: pr} : {s: svc || 'Additional information', d: det, i: 1});
  }
  if (!priced) warn.push('no priced line yet (PRICE 1-5 empty)'); else ok.push(priced + ' priced line' + (priced > 1 ? 's' : '') + ', total ' + money(sum));
  // client
  const cl = flat(v(F.client))[0] || '', cut = cl.lastIndexOf(' - ');
  const co = cut > 0 ? cl.slice(0, cut) : cl, cn = cut > 0 ? cl.slice(cut + 3) : '';
  if (!cl) warn.push('no CLIENT linked');
  const cEmail = flat(v(F.clientEmail))[0] || '';
  if (cl && !cEmail) warn.push('the client has no EMAIL ADDRESS (the draft needs one)'); else if (cEmail) ok.push('client ' + cl);
  // locations (store · address)
  const names = flat(v(F.storeName)), addrs = flat(v(F.storeAddr));
  const loc = (names.length ? names : addrs).map((n, i) => names.length && addrs[i] && !n.includes(addrs[i]) ? n + ' · ' + addrs[i] : n).slice(0, 40);
  if (!loc.length) warn.push('no store address on the project: the currency comes from the store address (Canada = CAD, USA = USD), so add the store before sending');
  // currency
  let cur = str(F.cur).toUpperCase(); if (!/^(USD|CAD)$/.test(cur)) { warn.push('PROJECT CURRENCY unknown (' + (cur || 'empty') + '): shown as USD'); cur = 'USD'; } else ok.push('currency ' + cur);
  // totals vs TOTAL COST, margin, suggested retail
  const tc = Number(v(F.totalCost)) || 0; if (priced && tc && Math.abs(tc - sum) > 1) warn.push('TOTAL COST ' + money(tc) + ' is not PRICE 1-5 ' + money(sum));
  const tb = Number(v(F.totalBudget)) || 0;
  if (priced && tb) { const m = (sum - tb) / sum; (m < 0.33 ? warn : ok).push('margin ' + Math.round(m * 100) + '% vs installer budget ' + money(tb) + ' (before the installer\'s tax' + (m < 0.33 ? '; goal 33-50%' : '') + ')'); }
  else if (priced) info.push('no installer budget yet: margin not checked');
  const sr = Number(v(F.sugRetail)) || 0;
  if (priced && sr) { const d = Math.round((sum - sr) / sr * 100); info.push('💲 suggested retail ' + money(sr) + ' (this estimate ' + (d >= 0 ? '+' : '') + d + '%)'); }
  // PM
  const pmName = flat(v(F.pm))[0] || '', pmEmail = flat(v(F.pmEmail))[0] || 'projects@americangraphiccontractors.com', pmPhone = flat(v(F.pmPhone))[0] || '1 (877) 395-7435';
  if (!pmName) info.push('no PM on the project: AGC contact shown instead');
  // title
  const full = str(F.name), t = full.replace(new RegExp('^\\s*' + agc + '\\s*(/|:|-)?\\s*'), '').trim() || full;
  const sched = v(F.sched);
  // payload (short keys = shorter link)
  const today = new Date(), until = new Date(today.getTime() + 30 * 864e5);
  const P = {v: 1, n: agc, t, d: ymd(today), x: ymd(until), co, cn, cur, loc, l: lines, tot: sum,
    pm: {nm: pmName || 'American Graphic Contractors', em: pmEmail, ph: pmPhone}};
  if (sched) P.dt = new Date(sched + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  // no tax line: AGC charges no tax (the page always shows $0)
  // change signature (content only, not the date) → rebuild only when something changed
  const content = JSON.stringify(Object.assign({}, P, {d: '', x: ''}));
  const sig = sha256(content).slice(0, 10);
  const prev = str(F.check), prevSig = (prev.match(/sig ([0-9a-f]{10})/) || [])[1], prevRev = Number((prev.match(/rev (\d+)/) || [])[1]) || 0;
  const stNow = /READY FOR ESTIMATE/i.test(status) ? 'R' : /AWAITING APPROVAL/i.test(status) ? 'A' : 'O', prevSt = (prev.match(/ · st ([RAO])\s*$/) || [])[1] || '';
  const reset = stNow === 'R' && prevSt !== 'R' && !!str(F.link); // moved back to READY FOR ESTIMATE (Chris, Nov 13): make a new estimate
  if (!force && !reset && prevSig === sig && str(F.link)) { if (prevSt !== stNow) await T.updateRecordAsync(rec.id, {[F.check]: prev.replace(/ · st [RAO]\s*$/, '') + ' · st ' + stNow}); return '⏭️ no change since rev ' + prevRev; }
  const rev = prevSig === sig && !reset ? Math.max(prevRev, 1) : prevRev + 1; P.r = rev;
  const code = sha256(JSON.stringify(P) + '|' + str(F.mapKey)).slice(0, 8).toUpperCase(); P.h = code.slice(0, 4) + '-' + code.slice(4);
  const link = PAGE + '#d=' + b64url(utf8(JSON.stringify(P)));
  if (link.length > 60000) warn.push('the estimate is very long (' + link.length + ' characters): check the link opens');
  const head = warn.length ? '⚠️ CHECK FIRST · ' + warn.length + ' thing' + (warn.length > 1 ? 's' : '') + ' to fix or confirm' : '✅ READY TO SEND · open the link, then tick Estimate Sent To Client';
  const when = new Date().toLocaleString('en-US', {timeZone: 'America/Edmonton', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
  const out = [head, ...warn.map(x => '⚠️ ' + x), ...ok.map(x => '✅ ' + x), ...info.map(x => 'ℹ️ ' + x),
    '🧾 rev ' + rev + ' · ' + when + ' MT · check code ' + P.h + ' · ' + (force ? 'built on request' : reset ? 'new estimate: status back to READY FOR ESTIMATE' : 'built by itself (' + status + ')') + ' · sig ' + sig + ' · st ' + stNow].join('\n');
  await T.updateRecordAsync(rec.id, {[F.link]: link, [F.check]: out, [F.build]: false});
  return (warn.length ? '⚠️ ' : '✅ ') + 'AGC ' + agc + ' estimate rev ' + rev + ' built (' + lines.length + ' lines, ' + money(sum) + ' ' + cur + ', ' + warn.length + ' to check)';
}
let status = '';
try { status = await main(); } catch (e) { status = '❌ ' + S(e && e.message || e); console.log(e && e.stack || e); }
console.log(status);
output.set('status', status);
if (status.startsWith('❌')) throw new Error(status);
