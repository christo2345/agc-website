// AGC PDF engine: estimate, project brief and SITE SURVEY (Nov 27, 2026). Pure JS, no libraries. Fonts + mark load from this folder.
// makeSurvey(D, fetchFn, photos) -> {bytes, name, pages}. Used inline by the Airtable automation '📐 SITE SURVEY PDF · build'.
const AGC_PDF = (() => {
const M = {"400":{"w":[195,222,352,660,660,756,677,222,316,316,412,660,222,334,222,484,646,456,598,599,646,592,622,594,624,622,222,222,660,660,660,561,1057,727,666,739,741,603,578,797,742,247,645,687,564,900,738,852,644,852,687,679,625,722,711,1052,668,647,609,313,484,313,660,500,584,550,633,545,633,601,380,633,584,214,214,547,214,921,584,614,633,633,364,514,392,582,537,772,508,537,488,389,214,389,660,0,660,0,222,0,362,1000,0,0,584,0,0,318,1235,0,0,0,0,222,222,362,362,354,500,1000,584,883,0,318,1033,0,0,0,195,222,660,660,632,660,214,596,584,852,458,502,660,334,526,584,448,660,428,405,584,660,624,222,584,366,506,502,939,980,977,561,727,727,727,727,727,727,1043,739,603,603,603,603,247,247,247,247,741,738,852,852,852,852,852,660,852,722,722,722,722,647,644,622,550,550,550,550,550,550,963,545,601,601,601,601,214,214,214,214,614,584,614,614,614,614,614,660,614,582,582,582,582,537,633,537],"asc":1008,"dsc":-252,"bbox":[-176,-255,1190,967],"cap":715},"700":{"w":[195,261,429,704,660,802,706,262,343,343,441,660,262,336,262,505,655,487,598,622,667,613,636,603,644,636,262,262,660,660,660,576,1024,771,675,752,755,619,592,810,753,277,676,738,576,917,758,864,657,864,708,699,648,740,759,1072,723,711,644,327,505,327,660,500,600,574,651,567,651,610,411,651,600,249,249,605,249,918,600,636,651,651,398,541,420,598,591,826,573,591,519,393,237,393,660,0,660,0,262,0,451,1000,0,0,600,0,0,365,1220,0,0,0,0,262,262,451,451,354,500,1000,600,917,0,365,1029,0,0,0,195,261,660,660,587,660,237,577,600,852,476,592,660,336,528,600,477,660,397,400,600,660,650,262,600,365,526,592,944,976,979,576,771,771,771,771,771,771,1079,752,619,619,619,619,277,277,277,277,755,758,864,864,864,864,864,660,864,740,740,740,740,711,657,648,574,574,574,574,574,574,968,567,610,610,610,610,249,249,249,249,636,600,636,636,636,636,636,660,641,598,598,598,598,591,651,591],"asc":1008,"dsc":-252,"bbox":[-219,-261,1175,988],"cap":715},"800":{"w":[195,286,478,732,660,831,725,288,360,360,459,660,288,338,288,519,660,506,598,637,681,627,645,608,656,645,288,288,660,660,660,586,1003,799,680,761,764,629,601,819,760,296,696,771,584,928,770,872,666,872,722,711,662,752,789,1084,758,752,666,336,519,336,660,500,611,590,663,581,663,616,430,663,611,271,271,642,271,916,611,650,663,663,419,558,438,609,625,860,614,625,539,396,252,396,660,0,660,0,288,0,507,1000,0,0,611,0,0,395,1211,0,0,0,0,288,288,507,507,354,500,1000,611,939,0,395,1027,0,0,0,195,286,660,660,558,660,252,565,611,852,487,649,660,338,530,611,495,660,377,397,611,660,667,288,611,365,538,649,948,973,980,586,799,799,799,799,799,799,1102,761,629,629,629,629,296,296,296,296,764,770,872,872,872,872,872,660,872,752,752,752,752,752,666,664,590,590,590,590,590,590,972,581,616,616,616,616,271,271,271,271,650,611,650,650,650,650,650,660,658,609,609,609,609,625,663,625],"asc":1008,"dsc":-252,"bbox":[-246,-265,1166,1002],"cap":715}};
const ASSET = 'https://christo2345.github.io/agc-website/estimate/pdf/';
const PW = 816, PH = 1056; // the page in CSS px (8.5 x 11 in at 96 px per inch); drawn at 0.75 pt per px
const LHN = 1.26; // 'normal' line height of the font
const C = {green: '92C64B', gdark: '4f7f1d', soft: 'f4f4f4', ink: '141414', ink2: '262626', ink3: '474747', line: 'e2e2e2', d1: '0d0d0d', d2: '161616', white: 'ffffff'};
// text in the PDF uses the Windows-1252 letters; anything else is swapped for the closest plain letter
const CP = {0x20AC: 128, 0x201A: 130, 0x201E: 132, 0x2026: 133, 0x02C6: 136, 0x2039: 139, 0x0152: 140, 0x2018: 145, 0x2019: 146, 0x201C: 147, 0x201D: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02DC: 152, 0x2122: 153, 0x203A: 155, 0x0153: 156};
const SWAP = {'Š': 'S', 'š': 's', 'Ž': 'Z', 'ž': 'z', 'Ÿ': 'Y', 'ƒ': 'f', '†': '+', '‡': '+', '‰': '%', '−': '-', '‐': '-', '‑': '-', '′': "'", '″': '"', ' ': ' ', '\t': ' '};
const enc = s => { const out = []; for (const ch of String(s == null ? '' : s)) { let c = SWAP[ch] !== undefined ? SWAP[ch] : ch; let u = c.codePointAt(0);
  if (u >= 32 && u < 127 || u >= 160 && u <= 255) { out.push(u); continue; } if (CP[u]) { out.push(CP[u]); continue; }
  const base = c.normalize ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : ''; const b = base && base.codePointAt(0);
  if (b && (b >= 32 && b < 127 || b >= 160 && b <= 255)) { out.push(b); continue; }
  if (u < 32) continue; if (u > 0xffff || /\p{Extended_Pictographic}/u.test(c)) continue; out.push(63); } return out; };
const width = (s, f, size, ls) => { const b = enc(s), W = M[f].w; let w = 0; for (const x of b) w += W[x - 32] || 0; return w * size / 1000 + (ls || 0) * b.length; };
const hex = h => [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' ');
const n2 = v => (Math.round(v * 100) / 100).toString();
// ---- one page of drawing commands ----
function Page() { this.ops = ['0.75 0 0 0.75 0 0 cm']; this.links = []; }
Page.prototype.Y = function (y) { return PH - y; };
Page.prototype.rr = function (x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); const k = 0.5523 * r, Y = v => n2(PH - v), X = n2;
  if (!r) return X(x) + ' ' + Y(y + h) + ' ' + X(w) + ' ' + n2(h) + ' re';
  return [X(x + r) + ' ' + Y(y) + ' m', X(x + w - r) + ' ' + Y(y) + ' l', X(x + w - r + k) + ' ' + Y(y) + ' ' + X(x + w) + ' ' + Y(y + r - k) + ' ' + X(x + w) + ' ' + Y(y + r) + ' c',
    X(x + w) + ' ' + Y(y + h - r) + ' l', X(x + w) + ' ' + Y(y + h - r + k) + ' ' + X(x + w - r + k) + ' ' + Y(y + h) + ' ' + X(x + w - r) + ' ' + Y(y + h) + ' c',
    X(x + r) + ' ' + Y(y + h) + ' l', X(x + r - k) + ' ' + Y(y + h) + ' ' + X(x) + ' ' + Y(y + h - r + k) + ' ' + X(x) + ' ' + Y(y + h - r) + ' c',
    X(x) + ' ' + Y(y + r) + ' l', X(x) + ' ' + Y(y + r - k) + ' ' + X(x + r - k) + ' ' + Y(y) + ' ' + X(x + r) + ' ' + Y(y) + ' c', 'h'].join(' '); };
Page.prototype.fill = function (x, y, w, h, r, col) { this.ops.push(hex(col) + ' rg ' + this.rr(x, y, w, h, r) + ' f'); };
Page.prototype.stroke = function (x, y, w, h, r, col, lw) { this.ops.push(hex(col) + ' RG ' + n2(lw) + ' w ' + this.rr(x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2)) + ' S'); };
Page.prototype.circle = function (cx, cy, r, col) { this.fill(cx - r, cy - r, 2 * r, 2 * r, r, col); };
Page.prototype.clip = function (x, y, w, h, r) { this.ops.push('q ' + this.rr(x, y, w, h, r) + ' W n'); };
Page.prototype.unclip = function () { this.ops.push('Q'); };
Page.prototype.image = function (x, y, w, h, nm) { this.ops.push('q ' + n2(w) + ' 0 0 ' + n2(h) + ' ' + n2(x) + ' ' + n2(PH - y - h) + ' cm /' + (nm || 'Im1') + ' Do Q'); };
Page.prototype.line = function (x1, y1, x2, y2, col, lw, dash) { this.ops.push('q ' + hex(col) + ' RG ' + n2(lw) + ' w ' + (dash ? '[' + dash + '] 0 d ' : '') + n2(x1) + ' ' + n2(PH - y1) + ' m ' + n2(x2) + ' ' + n2(PH - y2) + ' l S Q'); };
// text: x = left edge, top = top of the line box, lh = line height (px)
Page.prototype.text = function (s, x, top, f, size, col, ls, lh) { const b = enc(s); if (!b.length) return;
  const base = top + ((lh || size * LHN) - size * LHN) / 2 + size * M[f].asc / 1000;
  this.ops.push('BT /F' + f + ' ' + n2(size) + ' Tf ' + n2(ls || 0) + ' Tc ' + hex(col) + ' rg 1 0 0 1 ' + n2(x) + ' ' + n2(PH - base) + ' Tm <' + b.map(v => (v < 16 ? '0' : '') + v.toString(16)).join('') + '> Tj ET'); };
Page.prototype.link = function (x, y, w, h, uri) { this.links.push([x * .75, (PH - y - h) * .75, (x + w) * .75, (PH - y) * .75, uri]); };
// ---- wrapping ----
// runs: [{t, f, c, s, ls}] ; returns lines: [{segs: [{t, f, c, s, ls, x, w}], w}]
function wrap(runs, maxW) {
  const toks = []; runs.forEach(r => String(r.t).split(/( +)/).forEach(p => { if (p !== '') toks.push(Object.assign({}, r, {t: p, sp: /^ +$/.test(p)})); }));
  const lines = []; let cur = [], w = 0;
  const push = () => { while (cur.length && cur[cur.length - 1].sp) { w -= cur[cur.length - 1].w; cur.pop(); } lines.push({segs: cur, w: w}); cur = []; w = 0; };
  toks.forEach(t => { t.w = width(t.t, t.f, t.s, t.ls);
    if (t.sp) { if (cur.length) { cur.push(t); w += t.w; } return; }
    if (w + t.w > maxW + 0.01 && cur.length) push();
    if (t.w > maxW + 0.01) { let part = ''; for (const ch of t.t) { const pw = width(part + ch, t.f, t.s, t.ls); if (pw > maxW && part) { cur.push(Object.assign({}, t, {t: part, w: width(part, t.f, t.s, t.ls)})); w += cur[cur.length - 1].w; push(); part = ch; } else part += ch; }
      t = Object.assign({}, t, {t: part, w: width(part, t.f, t.s, t.ls)}); }
    cur.push(t); w += t.w; });
  if (cur.length || !lines.length) push();
  lines.forEach(L => { let x = 0; L.segs.forEach(s => { s.x = x; x += s.w; }); });
  return lines;
}
// a paragraph: {runs or text, f, s, c, ls, lh, w, align} -> {h, draw(pg, x, y)}
function para(o) {
  const runs = o.runs || [{t: o.text, f: o.f, c: o.c, s: o.s, ls: o.ls || 0}];
  runs.forEach(r => { r.f = r.f || o.f; r.c = r.c || o.c; r.s = r.s || o.s; r.ls = r.ls == null ? (o.ls || 0) : r.ls; });
  const lines = o.nowrap ? wrap(runs, 1e9) : wrap(runs, o.w); const lh = o.lh || o.s * LHN;
  return {h: lines.length * lh, lines: lines, w: Math.max(0, ...lines.map(l => l.w)), draw(pg, x, y, boxW) { lines.forEach((L, i) => { const dx = o.align === 'right' ? (boxW == null ? o.w : boxW) - L.w : o.align === 'center' ? ((boxW == null ? o.w : boxW) - L.w) / 2 : 0;
    L.segs.forEach(sg => { if (!sg.sp) pg.text(sg.t, x + dx + sg.x, y + i * lh, sg.f, sg.s, sg.c, sg.ls, lh); }); }); }};
}
const lbl = (t, w) => para({text: String(t).toUpperCase(), f: 800, s: 11.5, c: C.gdark, ls: 1.15, w: w});
const monthN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fdate = s => { const p = String(s || '').split('-'); if (p.length < 3 || !+p[1]) return String(s || ''); return monthN[+p[1] - 1] + ' ' + (+p[2]) + ', ' + (+p[0]); };
const money = v => { const n = Number(v) || 0, neg = n < 0, a = Math.abs(n), cents = Math.round(a * 100) % 100, whole = Math.floor(Math.round(a * 100) / 100);
  return (neg ? '-' : '') + '$' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + (cents < 10 ? '0' : '') + cents : ''); };

function build(D, A) {
  const cur = D.cur === 'CAD' ? 'CAD' : 'USD', curName = cur === 'CAD' ? 'Canadian dollars (CAD)' : 'US dollars (USD)';
  const lines = Array.isArray(D.l) ? D.l : []; let k = 0, sub = 0; const rows = [];
  lines.forEach(L => { if (L.g) { rows.push({L: L, grp: true, k: k}); return; } if (L.st || L.ah) { rows.push({L: L, st: true, ah: !!L.ah, k: k}); return; } const info = !(Number(L.a) > 0) && L.i; if (!info) { k++; sub += Number(L.a) || 0; } rows.push({L: L, info: !!info, k: k}); });
  const total = Number(D.tot) > 0 ? Number(D.tot) : sub;
  const locs = (Array.isArray(D.loc) ? D.loc : []).filter(Boolean);
  const terms = Array.isArray(D.terms) && D.terms.length ? D.terms : ['This estimate is based on the information we have today. Prices may change if the scope, sizes, quantities, site conditions or other details change.', 'A purchase order name or number is required to lock in the work.', 'Invoices are due on receipt, except for clients with accounts already set up with AGC.', 'Payment is accepted by ACH / EFT or by credit or debit card only.'];
  const pm = D.pm || {}; const who = [D.co, D.cn].filter(Boolean);
  const X0 = 52.8, CW = 710.4, GAP = 14; // the body: .55in side padding, .2in gap between blocks

  // ---- header (every page) ----
  const addr = String(D.ad || '#30 N Gould St Ste R, Sheridan, WY 82801, USA');
  const addrW = width(addr, 400, 12.5, 0.2), coW17 = width('AMERICAN GRAPHIC CONTRACTORS LLC', 800, 17, 0.68);
  const coS = 17 * addrW / coW17; // the company name is exactly as wide as the address
  const wordH = coS * 1.2 + 5 + 12.5 * 1.2, brandH = Math.max(58, wordH);
  const dl = [['Estimate', 'AGC ' + D.n + (D.r > 1 ? ' · rev ' + D.r : '')], ['Date', fdate(D.d)]]; if (D.x) dl.push(['Valid until', fdate(D.x)]);
  const dtW = Math.max(...dl.map(r => width(r[0].toUpperCase(), 700, 11, 0.55))), ddW = Math.max(...dl.map(r => width(r[1], 700, 14, 0)));
  const rowH = 14 * LHN, docH = 30 * LHN + 8 + dl.length * rowH + (dl.length - 1) * 3;
  const innerH = Math.max(brandH, docH), HX = 11.52, HW = PW - 23.04, HH = 20 * 2 + innerH;
  const drawHeader = pg => {
    pg.clip(HX, HX, HW, HH, 10); pg.fill(HX, HX, HW, HH, 0, C.d1); pg.fill(HX, HX + HH - 4, HW, 4, 0, C.green); pg.unclip();
    const top = HX + 20, L = HX + 41.28, R = HX + HW - 41.28;
    const by = top + (innerH - brandH) / 2; pg.image(L, by + (brandH - 58) / 2, 58, 58);
    const wy = by + (brandH - wordH) / 2;
    pg.text('AMERICAN GRAPHIC CONTRACTORS LLC', L + 72, wy, 800, coS, C.white, coS * 0.04, coS * 1.2);
    pg.text(addr, L + 72, wy + coS * 1.2 + 5, 400, 12.5, 'dcdcdc', 0.2, 15);
    const dy = top + (innerH - docH) / 2;
    pg.text('ESTIMATE', R - width('ESTIMATE', 800, 30, 3.6), dy, 800, 30, C.white, 3.6, 30 * LHN);
    dl.forEach((r, i) => { const y = dy + 30 * LHN + 8 + i * (rowH + 3), t = r[0].toUpperCase();
      pg.text(t, R - ddW - 14 - width(t, 700, 11, 0.55), y + 3, 700, 11, 'c8c8c8', 0.55, 11 * LHN);
      pg.text(r[1], R - width(r[1], 700, 14, 0), y, 700, 14, C.white, 0, rowH); });
  };
  // ---- footer (every page) ----
  const FH = 12 * 2 + 12 * LHN;
  const foot = para({runs: [{t: 'americangraphiccontractors.com', f: 700, c: C.green}, {t: '  ·  accounting@americangraphiccontractors.com  ·  1 (877) 395-7435', f: 400, c: 'e6e6e6'}], s: 12, ls: 0.15, nowrap: true});
  const drawFooter = pg => { pg.fill(0, PH - FH, PW, FH, 0, C.d1); const x = (PW - foot.w) / 2, y = PH - FH + 12; foot.draw(pg, x, y, foot.w);
    const s = foot.lines[0].segs; const w1 = s[0].w; pg.link(x, y, w1, 15.1, 'https://americangraphiccontractors.com');
    const pre = width('  ·  ', 400, 12, 0.15), em = width('accounting@americangraphiccontractors.com', 400, 12, 0.15);
    pg.link(x + w1 + pre, y, em, 15.1, 'mailto:accounting@americangraphiccontractors.com'); };
  const BODY_TOP = HX + HH + 18, BODY_BOT = PH - FH - 16;

  // ---- the blocks ----
  const blocks = [];
  { // cards: the two cards share the row by their content (like CSS flex: 1 1 auto), each at least a quarter of the row
    const mk = (w, parts) => { let h = 0; parts.forEach(p => { h += (p.mt || 0) + p.h; }); return {h: h, parts: parts}; };
    const card1 = w => { const lb = lbl('Prepared for', w); const big = para({text: who[0] || 'Our client', f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6;
      const p = [lb, big]; if (who[1]) { const s1 = para({text: who[1], f: 400, s: 14, c: C.ink2, lh: 19.5, w: w}); s1.mt = 3; p.push(s1); } return p; };
    // Nov 13 (Chris): the store addresses are not shown on the estimate (the project card is the project number and title only)
    const card2 = w => { const lb = lbl('Project', w); const big = para({text: String(D.n) + (D.t ? ' / ' + D.t : ''), f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6;
      const p = [lb, big]; if (D.dt) { const td = para({runs: [{t: 'Target date: ', f: 700}, {t: String(D.dt), f: 400}], s: 14, c: C.ink2, lh: 19.5, w: w}); td.mt = 6; p.push(td); } return p; };
    const natural = parts => 30 + Math.max(...parts.map(p => p.lines ? Math.max(...p.lines.map(l => l.w)) : 0)) + 2;
    const avail = CW - 14, minW = avail * 0.25;
    const n1 = natural(card1(1e6)), n2 = natural(card2(1e6));
    let w1, w2;
    if (n1 + n2 <= avail) { const extra = (avail - n1 - n2) / 2; w1 = n1 + extra; w2 = n2 + extra; } // room to spare: both grow by the same amount
    else if (n1 <= n2) { w1 = Math.min(n1, avail / 2); w2 = avail - w1; } // too long: the shorter card keeps its natural width (up to half), the longer one wraps
    else { w2 = Math.min(n2, avail / 2); w1 = avail - w2; }
    w1 = Math.min(Math.max(w1, minW), avail - minW); w2 = avail - w1;
    const c1 = mk(w1, card1(w1 - 30)), c2 = mk(w2, card2(w2 - 30)), h = Math.max(c1.h, c2.h) + 24;
    blocks.push({h: h, draw(pg, y) { [[c1, X0, w1], [c2, X0 + w1 + 14, w2]].forEach(([c, x, w]) => { pg.stroke(x, y, w, h, 12, C.line, 1); let yy = y + 12; c.parts.forEach(p => { yy += p.mt || 0; p.draw(pg, x + 15, yy); yy += p.h; }); }); }});
  }
  { // the currency note
    const bw = width(cur, 800, 12, 0.72) + 22, t = 'All prices on this estimate are in ' + curName + '.', h = 2 + 9 + 19.12 + 9 + 2;
    blocks.push({h: h, draw(pg, y) { pg.stroke(X0, y, CW, h, 12, C.green, 2); const by = y + (h - 19.12) / 2; pg.fill(X0 + 16, by, bw, 19.12, 9.56, C.green);
      pg.text(cur, X0 + 16 + 11, by + 2, 800, 12, C.d1, 0.72, 15.12); pg.text(t, X0 + 16 + bw + 10, y + (h - 16.4) / 2, 700, 13, C.ink, 0, 16.4); }});
  }
  // the price table: each line is its own block, the column titles repeat on every page
  const SW = CW * 0.32, AW = CW * 0.16, DW = CW - SW - AW;
  const THEAD = {h: 9 + 11 * LHN + 9, draw(pg, y) { pg.fill(X0, y, CW, this.h, 0, C.d2);
    pg.text('SERVICE', X0 + 12, y + 9, 800, 11, C.white, 1.1); pg.text('DESCRIPTION', X0 + SW + 12, y + 9, 800, 11, C.white, 1.1);
    pg.text('AMOUNT', X0 + CW - 12 - width('AMOUNT', 800, 11, 1.1), y + 9, 800, 11, C.white, 1.1); }};
  rows.forEach(R => { const L = R.L, info = R.info;
    if (R.grp) { // a group title band (Base items / Option A / Option B / Contingency)
      const nm = para({text: L.s, f: 800, s: 14, c: C.white, lh: 19, w: CW - 30});
      const ds = (Array.isArray(L.d) ? L.d : []).filter(Boolean).map(t => para({text: t, f: 400, s: 12.5, c: 'e6e6e6', lh: 17, w: CW - 30}));
      const h = 9 + nm.h + ds.reduce((a, b) => a + b.h + 2, 0) + 9;
      blocks.push({row: true, keep: true, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, '262626'); pg.fill(X0, y, 5, h, 0, C.green); nm.draw(pg, X0 + 16, y + 9);
        let yy = y + 9 + nm.h; ds.forEach(d => { yy += 2; d.draw(pg, X0 + 16, yy); yy += d.h; }); }});
      return;
    }
    if (R.st) { // a subtotal row: label + amount, light green band
      if (R.ah) { // an after hours line under a regular subtotal: white band, indented, grey text
        const an = para({text: L.s, f: 700, s: 13, c: C.ink2, lh: 18, w: SW + DW - 40}), aS = money(L.a), h2 = 7 + Math.max(an.h, 19) + 7 + 1;
        blocks.push({row: true, h: h2, draw(pg, y) { pg.fill(X0, y, CW, h2, 0, 'ffffff'); pg.fill(X0, y, 5, h2, 0, 'e8f2da'); pg.fill(X0, y + h2 - 1, CW, 1, 0, C.line); an.draw(pg, X0 + 28, y + 7 + 1);
          const ccW = width(cur, 800, 11, 0.55) + 4, mw = width(aS, 700, 14, 0), x = X0 + CW - 12 - ccW - mw; pg.text(aS, x, y + 7, 700, 14, C.ink2, 0, 20);
          const b14 = (20 - 14 * LHN) / 2 + 14 * M[700].asc / 1000, t11 = b14 - 11 * M[800].asc / 1000; pg.text(cur, x + mw + 4, y + 7 + t11, 800, 11, C.ink3, 0.55, 11 * LHN); }});
        return;
      }
      const nm = para({text: L.s, f: 800, s: 14, c: C.ink, lh: 19.5, w: SW + DW - 24}), amtS = money(L.a);
      const h = 10 + Math.max(nm.h, 21.5) + 10 + 1;
      blocks.push({row: true, keep: true, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, 'e8f2da'); pg.fill(X0, y + h - 1, CW, 1, 0, C.line); nm.draw(pg, X0 + 12, y + 10 + 1);
        const ccW = width(cur, 800, 11, 0.55) + 4, mw = width(amtS, 800, 15, 0), x = X0 + CW - 12 - ccW - mw; pg.text(amtS, x, y + 10, 800, 15, C.ink, 0, 21.5);
        const base15 = (21.5 - 15 * LHN) / 2 + 15 * M[800].asc / 1000, top11 = base15 - 11 * M[800].asc / 1000; pg.text(cur, x + mw + 4, y + 10 + top11, 800, 11, C.ink3, 0.55, 11 * LHN); }});
      return;
    }
    const name = para({text: L.s || (info ? 'Additional information' : 'Service'), f: info ? 700 : 800, s: 14, c: info ? C.ink2 : C.ink, lh: 19.5, w: SW - 24 - (info ? 0 : 28)});
    const bl = (Array.isArray(L.d) ? L.d : [L.d]).filter(Boolean).map(t => para({text: t, f: 400, s: 14, c: C.ink, lh: 19.5, w: DW - 24 - 15}));
    const dh = bl.length ? 2 + bl.reduce((a, b) => a + b.h, 0) + (bl.length - 1) : 0;
    const amt = info ? null : Number(L.a) > 0 ? [{t: money(L.a), f: 800, s: 15, c: C.ink, ls: 0}, {t: cur, f: 800, s: 11, c: C.ink3, ls: 0.55}] : [{t: 'Included', f: 800, s: 15, c: C.ink, ls: 0}];
    const h = 11 + Math.max(info ? name.h : Math.max(20, name.h), dh, amt ? 21.5 : 0) + 11 + 1;
    blocks.push({row: true, h: h, draw(pg, y) {
      if (info) pg.fill(X0, y, CW, h, 0, C.soft);
      pg.fill(X0, y + h - 1, CW, 1, 0, C.line);
      if (!info) { pg.circle(X0 + 12 + 10, y + 11 + 10, 10, C.green); const nt = String(R.k); pg.text(nt, X0 + 22 - width(nt, 800, 10, 0) / 2, y + 11, 800, 10, C.d1, 0, 20); name.draw(pg, X0 + 12 + 28, y + 11 + 0.75); }
      else name.draw(pg, X0 + 12, y + 11);
      let yy = y + 11 + 1; bl.forEach(b => { pg.circle(X0 + SW + 12 + 15 - 9, yy + 9.75, 2.5, C.ink); b.draw(pg, X0 + SW + 12 + 15, yy); yy += b.h + 1; });
      if (amt) { const ccW = amt[1] ? width(amt[1].t, 800, 11, 0.55) + 4 : 0, mw = width(amt[0].t, 800, 15, 0), x = X0 + CW - 12 - ccW - mw;
        pg.text(amt[0].t, x, y + 11, 800, 15, C.ink, 0, 21.5);
        if (amt[1]) { const base15 = (21.5 - 15 * LHN) / 2 + 15 * M[800].asc / 1000, top11 = base15 - 11 * M[800].asc / 1000; pg.text(cur, x + mw + 4, y + 11 + top11, 800, 11, C.ink3, 0.55, 11 * LHN); } }
    }});
  });
  if (Array.isArray(D.tb) && D.tb.length) { // terms + several totals (one per option)
    const TW = 340, tw = CW - 20 - TW;
    const tl = lbl('Terms', tw), items = terms.map(t => para({text: t, f: 400, s: 13, c: C.ink2, lh: 17.6, w: tw - 15}));
    const termsH = tl.h + 6 + 2 + items.reduce((a, b) => a + b.h, 0);
    const hH = 11.5 * LHN + 6, rH = 13.5 * LHN + 6, tH = 12.5 * LHN + 2 + 22 * LHN + 4, dv = 6 + 1 + 9;
    let boxH = 14; D.tb.forEach((r, i) => { if (r.h && i) boxH += dv; boxH += r.h ? hH : r.t ? tH : rH; }); boxH += 6 + 11.5 * LHN + 14;
    const h = Math.max(termsH, boxH);
    blocks.push({h: h, draw(pg, y) {
      tl.draw(pg, X0, y); let yy = y + tl.h + 6 + 2; items.forEach(it => { pg.circle(X0 + 6, yy + 8.85, 2.4, C.ink2); it.draw(pg, X0 + 15, yy); yy += it.h; });
      const x = X0 + CW - TW, ix = x + 16, iw = TW - 32; pg.fill(x, y, TW, h, 14, C.d1);
      const val = (v, ry, f, s) => { const cw = width(cur, 800, 11, 0.55), vw = width(v, f, s, 0), vx = ix + iw - cw - 4 - vw; pg.text(v, vx, ry, f, s, C.white, 0, s * LHN);
        const b = s * M[f].asc / 1000; pg.text(cur, vx + vw + 4, ry + b - 11 * M[800].asc / 1000, 800, 11, C.green, 0.55, 11 * LHN); };
      let ty = y + 14;
      D.tb.forEach((r, i) => {
        if (r.h) { if (i) { ty += 6; pg.fill(ix, ty, iw, 1, 0, '3a3a3a'); ty += 1 + 9; } pg.text(String(r.h).toUpperCase(), ix, ty, 800, 11.5, C.green, 1.15, 11.5 * LHN); ty += hH; return; }
        if (r.t) { pg.text(String(r.t).toUpperCase(), ix, ty, 800, 12.5, C.white, 1.25, 12.5 * LHN); ty += 12.5 * LHN + 2; val(money(r.a), ty, 700, 22); ty += 22 * LHN + 4; return; }
        pg.text(r.l, ix, ty + 3, 400, 13.5, 'e6e6e6', 0, 13.5 * LHN); val(money(r.a), ty + 3, 700, 13.5); ty += rH;
      });
      ty += 6; const ct = 'All amounts in ' + curName + '. No tax charged.';
      pg.text(ct, ix + iw - width(ct, 400, 11.5, 0), ty, 400, 11.5, 'cfcfcf', 0, 11.5 * LHN);
    }});
  } else { // terms + totals
    const TW = 312, tw = CW - 20 - TW;
    const tl = lbl('Terms', tw), items = terms.map(t => para({text: t, f: 400, s: 13, c: C.ink2, lh: 17.6, w: tw - 15}));
    const termsH = tl.h + 6 + 2 + items.reduce((a, b) => a + b.h, 0);
    const rH = 13.5 * LHN + 6, totH = 14 + rH * 2 + 7 + 1 + 9 + 24 * LHN + 3 + 2 + 11.5 * LHN + 14, h = Math.max(termsH, totH);
    blocks.push({h: h, draw(pg, y) {
      tl.draw(pg, X0, y); let yy = y + tl.h + 6 + 2; items.forEach(it => { pg.circle(X0 + 6, yy + 8.85, 2.4, C.ink2); it.draw(pg, X0 + 15, yy); yy += it.h; });
      const x = X0 + CW - TW, ix = x + 16, iw = TW - 32; pg.fill(x, y, TW, h, 14, C.d1);
      let ty = y + 14;
      const val = (v, ry) => { const cw = width(cur, 800, 11, 0.55), vw = width(v, 700, 13.5, 0), vx = ix + iw - cw - 4 - vw; pg.text(v, vx, ry + 3, 700, 13.5, C.white, 0, 13.5 * LHN);
        const b = 3 + (13.5 * M[700].asc / 1000); pg.text(cur, vx + vw + 4, ry + b - 11 * M[800].asc / 1000, 800, 11, C.green, 0.55, 11 * LHN); };
      pg.text('Subtotal', ix, ty + 3, 400, 13.5, 'e6e6e6', 0, 13.5 * LHN); val(money(sub), ty); ty += rH;
      pg.text('Tax', ix, ty + 3, 400, 13.5, 'e6e6e6', 0, 13.5 * LHN); val(money(0), ty); ty += rH;
      ty += 7; pg.fill(ix, ty, iw, 1, 0, '3a3a3a'); ty += 1 + 9;
      const base = ty + 24 * M[700].asc / 1000, tv = money(total), smW = width(cur, 700, 13, 0.78), tvW = width(tv, 700, 24, 0);
      pg.text('TOTAL', ix, base - 12.5 * M[800].asc / 1000, 800, 12.5, C.white, 1.25, 12.5 * LHN);
      pg.text(tv, ix + iw - smW - 6 - tvW, ty, 700, 24, C.white, 0, 24 * LHN);
      pg.text(cur, ix + iw - smW, base - 13 * M[700].asc / 1000, 700, 13, C.green, 0.78, 13 * LHN);
      ty += 24 * LHN + 3 + 2; const ct = 'All amounts in ' + curName + '. No tax charged.';
      pg.text(ct, ix + iw - width(ct, 400, 11.5, 0), ty, 400, 11.5, 'cfcfcf', 0, 11.5 * LHN);
    }});
  }
  if (pm.nm) { // the project manager
    const okW = 330, ok = para({text: 'Ready to go ahead? Reply to our email with your PO name or number and we will lock in your install.', f: 700, s: 13.5, c: C.ink, lh: 18.5, w: okW, align: 'right'});
    const lw = CW - 30 - 16 - ok.w, pl = lbl('Your project manager', lw), nm = para({text: pm.nm, f: 800, s: 15, c: C.ink, lh: 15 * LHN, w: lw});
    const cl = [pm.em, pm.ph].filter(Boolean).map(t => para({text: t, f: 400, s: 13.5, c: C.ink2, lh: 13.5 * LHN, w: lw})), ct = {h: cl.reduce((a, b) => a + b.h, 0), draw(pg, x, y) { let yy = y; cl.forEach(c => { c.draw(pg, x, yy); yy += c.h; }); }};
    const leftH = pl.h + 3 + nm.h + 2 + ct.h, h = 2 + 22 + Math.max(leftH, ok.h);
    blocks.push({h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 12, C.soft); pg.stroke(X0, y, CW, h, 12, C.line, 1);
      let ly = y + 12 + (h - 24 - leftH) / 2; pl.draw(pg, X0 + 15, ly); ly += pl.h + 3; nm.draw(pg, X0 + 15, ly); ly += nm.h + 2; ct.draw(pg, X0 + 15, ly);
      if (pm.em) pg.link(X0 + 15, ly, width(pm.em, 400, 13.5, 0), 17, 'mailto:' + pm.em);
      ok.draw(pg, X0 + CW - 15 - ok.w, y + 12 + (h - 24 - ok.h) / 2, ok.w); }});
  }
  { // the 3 next steps (at the bottom of the last page)
    const sw = (CW - 24) / 3, iw = sw - 28;
    const st = [['1', 'Approve + PO', 'Reply with your PO name or number and we book your date.'], ['2', 'Install', 'A vetted local installation partner completes the work on site.'], ['3', 'Photo closeout', 'You get completion photos for every location.']]
      .map(s => ({n: s[0], b: para({text: s[1], f: 700, s: 14.5, c: C.white, lh: 19.5, w: iw}), t: para({text: s[2], f: 400, s: 13, c: 'ededed', lh: 18, w: iw})}));
    const ih = Math.max(...st.map(s => Math.max(20, s.b.h) + 5 + s.t.h)), h = 24 + ih;
    blocks.push({h: h, bottom: true, draw(pg, y) { st.forEach((s, i) => { const x = X0 + i * (sw + 12); pg.fill(x, y, sw, h, 12, C.d2);
      pg.circle(x + 14 + 10, y + 12 + 10, 10, C.green); pg.text(s.n, x + 24 - width(s.n, 800, 10.5, 0) / 2, y + 12, 800, 10.5, C.d1, 0, 20);
      s.b.draw(pg, x + 14 + 28, y + 12 + 0.25); s.t.draw(pg, x + 14, y + 12 + Math.max(20, s.b.h) + 5); }); }});
  }

  // ---- pagination: full Letter pages, header on top, footer at the bottom ----
  const pages = []; let pg, y, inTable, hasBlock;
  const newPage = () => { pg = new Page(); pages.push(pg); drawHeader(pg); drawFooter(pg); y = BODY_TOP; inTable = false; hasBlock = false; };
  newPage();
  blocks.forEach((b, bi) => {
    if (b.row) {
      const nx = blocks[bi + 1], keep = b.keep && nx && nx.row ? nx.h : 0; // keep a band or subtotal with the row after it
      const need = (inTable ? 0 : (hasBlock ? GAP : 0) + THEAD.h) + b.h + keep;
      if (y + need > BODY_BOT && hasBlock) { newPage(); }
      if (!inTable) { if (hasBlock) y += GAP; THEAD.draw(pg, y); y += THEAD.h; inTable = true; hasBlock = true; }
      b.draw(pg, y); y += b.h; return;
    }
    inTable = false;
    const need = (hasBlock ? GAP : 0) + b.h;
    if (b.bottom && y + need > BODY_BOT) return; // the 3 steps never start a page of their own
    if (y + need > BODY_BOT && hasBlock) newPage();
    if (hasBlock) y += GAP;
    if (b.bottom) y = Math.max(y, BODY_BOT - b.h);
    b.draw(pg, y); y += b.h; hasBlock = true;
  });
  return pages;
}

// ---- the PROJECT BRIEF (same look as the estimate; rows grow, pages flow) ----
// D: {n, t, co, cn, store, addr, date, onsite, pm: {nm, em, ph}, assist: '<AGC ASSiST text>', fn}
const SECTIONS = [
  [/overview/i, 'PROJECT OVERVIEW', 'What the client wants, where, when and why'],
  [/scope|technical/i, 'SCOPE AND TECHNICAL DETAILS', 'What we install, what it is made of and what is still to confirm'],
  [/risk/i, 'RISK ANALYSIS', 'Operational, safety and environmental risks'],
  [/site check/i, 'SITE CHECK OBJECTIVES', 'What AGC must confirm on site before install or final pricing'],
  [/crew|equipment/i, 'CREW PLAN AND EQUIPMENT', 'Draft plan, the PM can adjust'],
  [/workflow/i, 'INSTALLATION WORKFLOW', 'High level sequence from receiving to sign off'],
  [/estimat/i, 'ESTIMATION GUIDANCE (INTERNAL)', 'What will drive the estimate. No dollar amounts in this brief.'],
  [/question|information required/i, 'OUTSTANDING QUESTIONS', 'What we must ask the client or property before pricing or scheduling is locked'],
  [/next step/i, 'NEXT STEPS FOR AGC', 'Internal action list for the PM']];
// house writing rules: no em or en dashes, no arrows, no emoji
const clean = s => String(s == null ? '' : s)
  .replace(/\p{Extended_Pictographic}️?/gu, '')
  .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
  .replace(/\s+[–—]\s+/g, ': ').replace(/[–—]/g, ', ')
  .replace(/\s*→\s*/g, ', then ')
  .replace(/[ \t]+$/gm, '').replace(/ {2,}/g, ' ').trim();
// **bold** -> runs
const runsOf = (s, f0, fb) => { const out = []; String(s).split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; const b = /^\*\*.*\*\*$/.test(p); out.push({t: b ? p.slice(2, -2) : p, f: b ? fb : f0}); }); return out.length ? out : [{t: '', f: f0}]; };
// the AGC ASSiST text -> [{title, note, items: [{k: 'sub'|'b'|'b2'|'num'|'p', t, n}]}]
function parseAssist(txt, opt) {
  opt = opt || {}; const secs = []; let cur = null, base = null; // base: the smallest bullet indent in the section (= level 1)
  String(txt || '').replace(/\r/g, '').split('\n').forEach(raw => {
    const line = raw.replace(/\s+$/, ''); if (!line.trim() || /^\s*-{3,}\s*$/.test(line)) return;
    const sub3 = line.match(/^\s*#{3,}\s*(.+)$/);
    const hm = !sub3 && line.match(/^\s*(?:🌱|#{1,2}(?!#))\s*(.+)$/u);
    if (hm) { const head = clean(hm[1].replace(/\*\*/g, '')).trim(); const m = opt.docTitles ? null : SECTIONS.find(s => s[0].test(head));
      cur = {title: m ? m[1] : head.replace(/&/g, 'AND').toUpperCase(), note: m ? m[2] : '', items: []}; secs.push(cur); base = null; return; }
    if (!cur) { cur = {title: 'PROJECT OVERVIEW', note: opt.docTitles ? '' : SECTIONS[0][2], items: []}; secs.push(cur); }
    const ind = line.match(/^\s*/)[0].length, t = line.trim();
    let m;
    if (sub3) { cur.items.push({k: 'sub', t: clean(sub3[1].replace(/\*\*/g, ''))}); return; }
    if ((m = t.match(/^\*\*([^*]+)\*\*:?$/)) || (opt.docTitles && (m = t.match(/^([A-Z][^.:]{2,40}):$/)))) { cur.items.push({k: 'sub', t: clean(m[1]).replace(/:$/, '')}); return; }
    const isB = /^[-*•]\s+/.test(t), isN = /^\d+[).]\s+/.test(t);
    if ((isB || isN) && (base == null || ind < base)) base = ind;
    const deep = base != null && ind >= base + 2;
    if ((m = t.match(/^(\d+)[).]\s+(.*)$/))) cur.items.push({k: deep ? 'num2' : 'num', n: m[1], t: clean(m[2])});
    else if ((m = t.match(/^[-*•]\s+(.*)$/))) cur.items.push({k: deep ? 'b2' : 'b', t: clean(m[1])});
    else { let p = clean(t); if (opt.docTitles) p = p.replace(/^([A-Z][A-Za-z ]{2,30}):\s/, '**$1:** '); cur.items.push({k: 'p', t: p}); }
  });
  return secs;
}

function buildBrief(D, A) {
  const X0 = 52.8, CW = 710.4, GAP = 14, MARGIN = 52.8;
  const pm = D.pm || {}, TBC = 'To be confirmed';
  const secs = parseAssist(D.assist, {docTitles: !!D.client});
  const all = JSON.stringify([D.t, D.co, D.cn, D.store, D.addr, D.onsite, secs]);
  if (/\$\s?\d/.test(all)) throw new Error('pricing found in the brief text');

  // ---- header (page 1 only) ----
  const addr = String(D.ad || '#30 N Gould St Ste R, Sheridan, WY 82801, USA');
  const addrW = width(addr, 400, 12.5, 0.2), coW17 = width('AMERICAN GRAPHIC CONTRACTORS LLC', 800, 17, 0.68);
  const coS = 17 * addrW / coW17, wordH = coS * 1.2 + 5 + 12.5 * 1.2, brandH = Math.max(58, wordH);
  const dl = [['AGC #', String(D.n)], [D.dateLabel || 'Install date', D.dateText || (D.date ? fdate(D.date) : TBC)], ['PM', pm.nm || TBC]];
  const ddW = Math.max(...dl.map(r => width(r[1], 700, 14, 0)));
  const rowH = 14 * LHN, HX = 11.52, HW = PW - 23.04;
  const L0 = HX + 41.28, R0 = HX + HW - 41.28, brandW = 72 + addrW;
  const TITLE = 'PROJECT BRIEF', tW30 = width(TITLE, 800, 30, 3.6);
  const tS = Math.min(30, 30 * (R0 - L0 - brandW - 28) / tW30); // never runs into the company name
  const docH = tS * LHN + 8 + dl.length * rowH + (dl.length - 1) * 3, innerH = Math.max(brandH, docH), HH = 40 + innerH;
  const drawHeader = pg => {
    pg.clip(HX, HX, HW, HH, 10); pg.fill(HX, HX, HW, HH, 0, C.d1); pg.fill(HX, HX + HH - 4, HW, 4, 0, C.green); pg.unclip();
    const top = HX + 20, by = top + (innerH - brandH) / 2; pg.image(L0, by + (brandH - 58) / 2, 58, 58);
    const wy = by + (brandH - wordH) / 2;
    pg.text('AMERICAN GRAPHIC CONTRACTORS LLC', L0 + 72, wy, 800, coS, C.white, coS * 0.04, coS * 1.2);
    pg.text(addr, L0 + 72, wy + coS * 1.2 + 5, 400, 12.5, 'dcdcdc', 0.2, 15);
    const dy = top + (innerH - docH) / 2;
    pg.text(TITLE, R0 - width(TITLE, 800, tS, tS * 0.12), dy, 800, tS, C.white, tS * 0.12, tS * LHN);
    dl.forEach((r, i) => { const y = dy + tS * LHN + 8 + i * (rowH + 3), t = r[0].toUpperCase();
      pg.text(t, R0 - ddW - 14 - width(t, 700, 11, 0.55), y + 3, 700, 11, 'c8c8c8', 0.55, 11 * LHN);
      pg.text(r[1], R0 - width(r[1], 700, 14, 0), y, 700, 14, C.white, 0, rowH); });
  };
  // ---- footer (last page only) ----
  const FH = 12 * 2 + 12 * LHN, EM = 'projects@americangraphiccontractors.com';
  const foot = para({runs: [{t: 'americangraphiccontractors.com', f: 700, c: C.green}, {t: '  ·  ' + EM + '  ·  1 (877) 395-7435', f: 400, c: 'e6e6e6'}], s: 12, ls: 0.15, nowrap: true});
  const drawFooter = pg => { pg.fill(0, PH - FH, PW, FH, 0, C.d1); const x = (PW - foot.w) / 2, y = PH - FH + 12; foot.draw(pg, x, y, foot.w);
    const w1 = foot.lines[0].segs[0].w; pg.link(x, y, w1, 15.1, 'https://americangraphiccontractors.com');
    pg.link(x + w1 + width('  ·  ', 400, 12, 0.15), y, width(EM, 400, 12, 0.15), 15.1, 'mailto:' + EM); };
  const P1_TOP = HX + HH + 18, TOP = MARGIN, BOT = PH - MARGIN, BOT_LAST = PH - FH - 16;

  // ---- blocks ----
  const blocks = [];
  { // cards: client + project
    const who = [D.co, D.cn].filter(Boolean);
    const card1 = w => { const p = [lbl('Client', w)]; const big = para({text: who[0] || TBC, f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6; p.push(big);
      if (who[1]) { const s1 = para({text: who[1], f: 400, s: 14, c: C.ink2, lh: 19.5, w: w}); s1.mt = 3; p.push(s1); } return p; };
    const card2 = w => { const p = [lbl('Project', w)]; const big = para({text: String(D.n) + (D.t ? ' / ' + D.t : ''), f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6; p.push(big);
      const st = para({runs: [{t: 'Store: ', f: 700}, {t: [D.store, D.addr].filter(Boolean).join(', ') || TBC, f: 400}], s: 14, c: C.ink2, lh: 19.5, w: w}); st.mt = 6; p.push(st); return p; };
    const natural = parts => 30 + Math.max(...parts.map(p => Math.max(...p.lines.map(l => l.w)))) + 2;
    const avail = CW - 14, minW = avail * 0.3, n1 = natural(card1(1e6)), n2 = natural(card2(1e6));
    let w1; if (n1 + n2 <= avail) w1 = n1 + (avail - n1 - n2) / 2; else if (n1 <= n2) w1 = Math.min(n1, avail / 2); else w1 = avail - Math.min(n2, avail / 2);
    w1 = Math.min(Math.max(w1, minW), avail - minW); const w2 = avail - w1;
    const mk = parts => ({parts: parts, h: parts.reduce((a, p) => a + (p.mt || 0) + p.h, 0)});
    const c1 = mk(card1(w1 - 30)), c2 = mk(card2(w2 - 30)), h = Math.max(c1.h, c2.h) + 24;
    blocks.push({h: h, draw(pg, y) { [[c1, X0, w1], [c2, X0 + w1 + 14, w2]].forEach(([c, x, w]) => { pg.stroke(x, y, w, h, 12, C.line, 1); let yy = y + 12; c.parts.forEach(p => { yy += p.mt || 0; p.draw(pg, x + 15, yy); yy += p.h; }); }); }});
  }
  { // the internal strip
    const bw = width('AGC', 800, 12, 0.72) + 22, t = para({text: D.strip || 'Internal brief for AGC project managers and installation partners. No pricing.', f: 700, s: 13, c: C.ink, lh: 16.4, w: CW - 32 - bw - 10 - 16});
    const h = 2 + 9 + Math.max(19.12, t.h) + 9 + 2;
    blocks.push({h: h, draw(pg, y) { pg.stroke(X0, y, CW, h, 12, C.green, 2); const by = y + (h - 19.12) / 2; pg.fill(X0 + 16, by, bw, 19.12, 9.56, C.green);
      pg.text('AGC', X0 + 16 + 11, by + 2, 800, 12, C.d1, 0.72, 15.12); t.draw(pg, X0 + 16 + bw + 10, y + (h - t.h) / 2); }});
  }
  // a band (section title), kept with the block after it
  const band = (title, note, sec) => { const nm = para({text: title, f: 800, s: 14, c: C.white, lh: 19, w: CW - 30});
    const ds = note ? para({text: note, f: 400, s: 12.5, c: 'e6e6e6', lh: 17, w: CW - 30}) : null; const h = 9 + nm.h + (ds ? 2 + ds.h : 0) + 9;
    return {band: true, keep: true, sec: sec, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, '262626'); pg.fill(X0, y, 5, h, 0, C.green); nm.draw(pg, X0 + 16, y + 9); if (ds) ds.draw(pg, X0 + 16, y + 9 + nm.h + 2); }}; };
  const contBand = sec => { const nm = para({text: sec + ' (CONTINUED)', f: 800, s: 12.5, c: C.white, lh: 17, w: CW - 30}), h = 7 + nm.h + 7;
    return {h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, '262626'); pg.fill(X0, y, 5, h, 0, C.green); nm.draw(pg, X0 + 16, y + 7); }}; };
  // a label / value row (key details)
  const LW = 215, VX = 239.33, VW = CW - VX - 12;
  const kv = (k, v, sec, last) => { const kp = para({text: k, f: 700, s: 13.5, c: C.ink, lh: 19, w: LW}), vp = para({text: v || TBC, f: 400, s: 13.5, c: v ? C.ink : C.ink3, lh: 19, w: VW});
    const h = 10 + Math.max(kp.h, vp.h) + 10 + 1;
    return {sec: sec, h: h, draw(pg, y) { pg.fill(X0, y + h - 1, CW, 1, 0, C.line); kp.draw(pg, X0 + 12, y + 10); vp.draw(pg, X0 + VX, y + 10); }}; };
  // content items inside a section
  const IX = X0 + 16, IW = CW - 32;
  const item = (it, sec, first) => {
    if (it.k === 'sub') { const p = lbl(it.t, IW), mt = first ? 12 : 16; return {sec: sec, keep: true, h: mt + p.h + 4, draw(pg, y) { p.draw(pg, IX, y + mt); }}; }
    const lvl2 = it.k === 'b2' || it.k === 'num2', x = IX + (lvl2 ? 22 : 0), w = IW - (lvl2 ? 22 : 0), mt = first ? 12 : 5;
    if (it.k === 'num' || it.k === 'num2') { const p = para({runs: runsOf(it.t, 400, 700), s: 13.5, c: C.ink, lh: 19, w: w - 28}), h = mt + Math.max(20, p.h);
      return {sec: sec, h: h, draw(pg, y) { const cy = y + mt; pg.circle(x + 10, cy + 9.5, 9.5, C.green); pg.text(String(it.n), x + 10 - width(String(it.n), 800, 10, 0) / 2, cy, 800, 10, C.d1, 0, 19); p.draw(pg, x + 28, cy); }}; }
    if (it.k === 'b' || it.k === 'b2') { const p = para({runs: runsOf(it.t, 400, 700), s: 13.5, c: C.ink, lh: 19, w: w - 16}), h = mt + p.h;
      return {sec: sec, h: h, draw(pg, y) { const cy = y + mt; if (lvl2) pg.stroke(x + 3.5, cy + 6.5, 6, 6, 3, C.ink3, 1.1); else pg.circle(x + 6, cy + 9.5, 2.6, C.green); p.draw(pg, x + 16, cy); }}; }
    const p = para({runs: runsOf(it.t, 400, 700), s: 13.5, c: C.ink2, lh: 19, w: w}), h = mt + p.h;
    return {sec: sec, h: h, draw(pg, y) { p.draw(pg, x, y + mt); }};
  };
  const endPad = sec => ({sec: sec, end: true, h: 12, draw(pg, y) { pg.fill(X0, y + 11, CW, 1, 0, C.line); }});
  // key details
  blocks.push(Object.assign(band('KEY DETAILS', D.client ? '' : 'From the project record in Airtable', 'KEY DETAILS'), {gap: true}));
  (D.kv || [['Store / address', [D.store, D.addr].filter(Boolean).join(', ')], ['Install date', D.date ? fdate(D.date) : ''], ['Onsite contact', D.onsite],
    ['Client contact', [D.cn, D.co].filter(Boolean).join(', ')], ['Project manager', [pm.nm, pm.em, pm.ph].filter(Boolean).map(t => String(t).replace(/ /g, '\u00a0')).join('  ·  ')]])
    .forEach(r => blocks.push(kv(r[0], r[1], 'KEY DETAILS')));
  // the AGC ASSiST sections
  secs.forEach(s => { blocks.push(Object.assign(band(s.title, s.note, s.title), {gap: true}));
    if (!s.items.length) s.items.push({k: 'p', t: 'Nothing from AGC ASSiST for this section yet.'});
    s.items.forEach((it, i) => blocks.push(item(it, s.title, i === 0))); blocks.push(endPad(s.title)); });
  if (pm.nm) { // the project manager card
    const pl = lbl('Project manager', CW - 30), nm = para({text: pm.nm, f: 800, s: 15, c: C.ink, lh: 15 * LHN, w: CW - 30});
    const ct = para({text: [pm.em, pm.ph].filter(Boolean).join('  ·  '), f: 400, s: 13.5, c: C.ink2, lh: 13.5 * LHN, w: CW - 30}), h = 12 + pl.h + 3 + nm.h + 2 + ct.h + 12;
    blocks.push({gap: true, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 12, C.soft); pg.stroke(X0, y, CW, h, 12, C.line, 1); let ly = y + 12; pl.draw(pg, X0 + 15, ly); ly += pl.h + 3; nm.draw(pg, X0 + 15, ly); ly += nm.h + 2; ct.draw(pg, X0 + 15, ly);
      if (pm.em) pg.link(X0 + 15, ly, width(pm.em, 400, 13.5, 0), 17, 'mailto:' + pm.em); }});
  }

  // ---- pagination: header on page 1, footer on the last page, a section that breaks gets a (continued) band ----
  // a short section (up to about a third of a page) is never split: it moves whole to the next page
  blocks.forEach((b, i) => { if (!b.band) return; let h = 0; for (let j = i; j < blocks.length && (j === i || !blocks[j].band) && !(j > i && blocks[j].gap); j++) h += blocks[j].h; b.sh = h; });
  const layout = forced => { const pl = []; let p = 0, y = P1_TOP, has = false;
    const brk = (b) => { p++; y = TOP; has = false; if (b.sec && !b.band) { const cb = contBand(b.sec); pl.push({b: cb, p: p, y: y}); y += cb.h; has = true; } };
    blocks.forEach((b, i) => {
      const nx = blocks[i + 1]; let keepH = 0; if (b.keep && nx) keepH = nx.h; // a band or a sub title never ends a page
      const g = has && b.gap ? GAP : 0;
      if (b.band && has && b.sh <= 200 && y + (b.gap ? GAP : 0) + b.sh > BOT && !forced.has(i)) brk(b);
      if (b.end && has && y + b.h > BOT) return; // a section's closing line never starts a page
      if (forced.has(i) || (has && y + g + b.h + keepH > BOT)) brk(b);
      if (has && b.gap) y += GAP;
      pl.push({b: b, p: p, y: y, i: i}); y += b.h; has = true; });
    return {pl: pl, n: p + 1, endY: y}; };
  const forced = new Set(); let lay = layout(forced);
  for (let guard = 0; guard < 50 && lay.endY > BOT_LAST; guard++) { // the footer must fit on the last page: move the tail to a new page
    const last = lay.pl.filter(q => q.p === lay.n - 1 && q.i != null);
    let j = last.findIndex(q => q.y + q.b.h > BOT_LAST - 0.01); if (j < 0) break;
    while (j > 0 && last[j - 1].b.keep) j--; // never leave a band or sub title alone at the bottom
    if (j === 0) break; forced.add(last[j].i); lay = layout(forced); }
  const pages = []; for (let i = 0; i < lay.n; i++) pages.push(new Page());
  drawHeader(pages[0]); drawFooter(pages[pages.length - 1]);
  lay.pl.forEach(q => q.b.draw(pages[q.p], q.y));
  return pages;
}

// ---- the SITE SURVEY (same look as the estimate and the brief; sections grow, pages flow) ----
// D: {n, t, co, cn, store, addr, date, surveyor, kv: [[k, v]], faces: [{name, w, h, surface, notes: [], door: {left, right, w, h, frame}}],
//     sections: [{title, note, items: [{k: 'b'|'num'|'p'|'sub', t}]}] (doors, adhesion, access, power...), photos: [{img: 'Ph1', w, h, cap}],
//     notes: [], questions: [], pm: {nm, em, ph}, fn, strip}
// inches -> 45 3/4"
const inch = v => { const n = Number(v); if (!isFinite(n)) return String(v || ''); const whole = Math.floor(n + 1e-9), fr = Math.round((n - whole) * 8);
  const F = {0: '', 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8', 8: ''}; const w = fr === 8 ? whole + 1 : whole;
  return (w ? String(w) : '') + (F[fr] ? (w ? ' ' : '') + F[fr] : '') + '"'; };
function buildSurvey(D, A) {
  const HX0 = 11.52;
  const X0 = 52.8, CW = 710.4, GAP = 14, MARGIN = 52.8;
  const pm = D.pm || {}, TBC = 'Not recorded';
  const all = JSON.stringify(D);
  if (/\$\s?\d/.test(all)) throw new Error('pricing found in the survey text');
  const faces = (D.faces || []).map((f, i) => Object.assign({k: i + 1}, f));

  // ---- header (page 1 only) ----
  const addr = String(D.ad || '#30 N Gould St Ste R, Sheridan, WY 82801, USA');
  const addrW = width(addr, 400, 12.5, 0.2), coW17 = width('AMERICAN GRAPHIC CONTRACTORS LLC', 800, 17, 0.68);
  const coS = 17 * addrW / coW17, wordH = coS * 1.2 + 5 + 12.5 * 1.2, brandH = Math.max(58, wordH);
  // Nov 27 (Chris): the surveyor's first name with their company ('Patrick, Anderson Signs - Calgary'); the header falls back to the first name when it would run into the company block
  const svFull = clean(D.surveyor) || TBC, svShort = clean(D.surveyorShort || String(D.surveyor || '').split(',')[0]) || TBC;
  const dl = [['AGC #', String(D.n)], ['Survey date', D.date ? fdate(D.date) : TBC], ['Surveyor', svFull]];
  { const fits = () => { const w = Math.max(...dl.map(r => width(r[1], 700, 14, 0))); return HX0 + 41.28 + 72 + width(String(D.ad || '#30 N Gould St Ste R, Sheridan, WY 82801, USA'), 400, 12.5, 0.2) + 28 < (HX0 + PW - 23.04 - 41.28) - w - 14 - width('SURVEY DATE', 700, 11, 0.55); };
    if (!fits()) dl[2][1] = svShort; }
  const ddW = Math.max(...dl.map(r => width(r[1], 700, 14, 0)));
  const rowH = 14 * LHN, HX = 11.52, HW = PW - 23.04;
  const L0 = HX + 41.28, R0 = HX + HW - 41.28, brandW = 72 + addrW;
  const TITLE = 'SITE SURVEY', tW30 = width(TITLE, 800, 30, 3.6);
  const tS = Math.min(30, 30 * (R0 - L0 - brandW - 28) / tW30);
  const docH = tS * LHN + 8 + dl.length * rowH + (dl.length - 1) * 3, innerH = Math.max(brandH, docH), HH = 40 + innerH;
  const drawHeader = pg => {
    pg.clip(HX, HX, HW, HH, 10); pg.fill(HX, HX, HW, HH, 0, C.d1); pg.fill(HX, HX + HH - 4, HW, 4, 0, C.green); pg.unclip();
    const top = HX + 20, by = top + (innerH - brandH) / 2; pg.image(L0, by + (brandH - 58) / 2, 58, 58);
    const wy = by + (brandH - wordH) / 2;
    pg.text('AMERICAN GRAPHIC CONTRACTORS LLC', L0 + 72, wy, 800, coS, C.white, coS * 0.04, coS * 1.2);
    pg.text(addr, L0 + 72, wy + coS * 1.2 + 5, 400, 12.5, 'dcdcdc', 0.2, 15);
    const dy = top + (innerH - docH) / 2;
    pg.text(TITLE, R0 - width(TITLE, 800, tS, tS * 0.12), dy, 800, tS, C.white, tS * 0.12, tS * LHN);
    dl.forEach((r, i) => { const y = dy + tS * LHN + 8 + i * (rowH + 3), t = r[0].toUpperCase();
      pg.text(t, R0 - ddW - 14 - width(t, 700, 11, 0.55), y + 3, 700, 11, 'c8c8c8', 0.55, 11 * LHN);
      pg.text(r[1], R0 - width(r[1], 700, 14, 0), y, 700, 14, C.white, 0, rowH); });
  };
  // ---- footer (last page only) ----
  const FH = 12 * 2 + 12 * LHN, EM = 'projects@americangraphiccontractors.com';
  const foot = para({runs: [{t: 'americangraphiccontractors.com', f: 700, c: C.green}, {t: '  ·  ' + EM + '  ·  1 (877) 395-7435', f: 400, c: 'e6e6e6'}], s: 12, ls: 0.15, nowrap: true});
  const drawFooter = pg => { pg.fill(0, PH - FH, PW, FH, 0, C.d1); const x = (PW - foot.w) / 2, y = PH - FH + 12; foot.draw(pg, x, y, foot.w);
    const w1 = foot.lines[0].segs[0].w; pg.link(x, y, w1, 15.1, 'https://americangraphiccontractors.com');
    pg.link(x + w1 + width('  ·  ', 400, 12, 0.15), y, width(EM, 400, 12, 0.15), 15.1, 'mailto:' + EM); };
  const P1_TOP = HX + HH + 18, TOP = MARGIN, BOT = PH - MARGIN, BOT_LAST = PH - FH - 16;

  // ---- building blocks (same styles as the brief) ----
  const blocks = [];
  const band = (title, note, sec) => { const nm = para({text: title, f: 800, s: 14, c: C.white, lh: 19, w: CW - 30});
    const ds = note ? para({text: clean(note), f: 400, s: 12.5, c: 'e6e6e6', lh: 17, w: CW - 30}) : null; const h = 9 + nm.h + (ds ? 2 + ds.h : 0) + 9;
    return {band: true, keep: true, gap: true, sec: sec, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, '262626'); pg.fill(X0, y, 5, h, 0, C.green); nm.draw(pg, X0 + 16, y + 9); if (ds) ds.draw(pg, X0 + 16, y + 9 + nm.h + 2); }}; };
  const contBand = sec => { const nm = para({text: sec + ' (CONTINUED)', f: 800, s: 12.5, c: C.white, lh: 17, w: CW - 30}), h = 7 + nm.h + 7;
    return {h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 0, '262626'); pg.fill(X0, y, 5, h, 0, C.green); nm.draw(pg, X0 + 16, y + 7); }}; };
  const LW = 215, VX = 239.33, VW = CW - VX - 12;
  const kv = (k, v, sec) => { const vv = clean(v); const kp = para({text: k, f: 700, s: 13.5, c: C.ink, lh: 19, w: LW}), vp = para({runs: runsOf(vv || TBC, 400, 700), s: 13.5, c: vv ? C.ink : C.ink3, lh: 19, w: VW});
    const h = 10 + Math.max(kp.h, vp.h) + 10 + 1;
    return {sec: sec, h: h, draw(pg, y) { pg.fill(X0, y + h - 1, CW, 1, 0, C.line); kp.draw(pg, X0 + 12, y + 10); vp.draw(pg, X0 + VX, y + 10); }}; };
  const IX = X0 + 16, IW = CW - 32;
  const item = (it, sec, first) => { const t = clean(it.t);
    if (it.k === 'sub') { const p = lbl(t, IW), mt = first ? 12 : 16; return {sec: sec, keep: true, h: mt + p.h + 4, draw(pg, y) { p.draw(pg, IX, y + mt); }}; }
    const mt = first ? 12 : 5;
    if (it.k === 'num') { const p = para({runs: runsOf(t, 400, 700), s: 13.5, c: C.ink, lh: 19, w: IW - 28}), h = mt + Math.max(20, p.h);
      return {sec: sec, h: h, draw(pg, y) { const cy = y + mt; pg.circle(IX + 10, cy + 9.5, 9.5, C.green); pg.text(String(it.n), IX + 10 - width(String(it.n), 800, 10, 0) / 2, cy, 800, 10, C.d1, 0, 19); p.draw(pg, IX + 28, cy); }}; }
    if (it.k === 'b') { const p = para({runs: runsOf(t, 400, 700), s: 13.5, c: C.ink, lh: 19, w: IW - 16}), h = mt + p.h;
      return {sec: sec, h: h, draw(pg, y) { const cy = y + mt; pg.circle(IX + 6, cy + 9.5, 2.6, C.green); p.draw(pg, IX + 16, cy); }}; }
    const p = para({runs: runsOf(t, 400, 700), s: 13.5, c: C.ink2, lh: 19, w: IW}), h = mt + p.h;
    return {sec: sec, h: h, draw(pg, y) { p.draw(pg, IX, y + mt); }}; };
  const endPad = sec => ({sec: sec, end: true, h: 12, draw(pg, y) { pg.fill(X0, y + 11, CW, 1, 0, C.line); }});
  const section = (title, note, items) => { blocks.push(band(title, note, title));
    (items.length ? items : [{k: 'p', t: TBC}]).forEach((it, i) => blocks.push(item(it, title, i === 0))); blocks.push(endPad(title)); };

  { // cards: client + store
    const who = [D.co, D.cn].filter(Boolean);
    const card1 = w => { const p = [lbl('Client', w)]; const big = para({text: who[0] || 'To be confirmed', f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6; p.push(big);
      if (who[1]) { const s1 = para({text: who[1], f: 400, s: 14, c: C.ink2, lh: 19.5, w: w}); s1.mt = 3; p.push(s1); } return p; };
    const card2 = w => { const p = [lbl('Store and address', w)]; const big = para({text: D.store || String(D.n), f: 800, s: 17, c: C.ink, lh: 21.5, w: w}); big.mt = 6; p.push(big);
      if (D.addr) { const st = para({text: D.addr, f: 400, s: 14, c: C.ink2, lh: 19.5, w: w}); st.mt = 3; p.push(st); } return p; };
    const natural = parts => 30 + Math.max(...parts.map(p => Math.max(...p.lines.map(l => l.w)))) + 2;
    const avail = CW - 14, minW = avail * 0.3, n1 = natural(card1(1e6)), n2 = natural(card2(1e6));
    let w1; if (n1 + n2 <= avail) w1 = n1 + (avail - n1 - n2) / 2; else if (n1 <= n2) w1 = Math.min(n1, avail / 2); else w1 = avail - Math.min(n2, avail / 2);
    w1 = Math.min(Math.max(w1, minW), avail - minW); const w2 = avail - w1;
    const mk = parts => ({parts: parts, h: parts.reduce((a, p) => a + (p.mt || 0) + p.h, 0)});
    const c1 = mk(card1(w1 - 30)), c2 = mk(card2(w2 - 30)), h = Math.max(c1.h, c2.h) + 24;
    blocks.push({h: h, draw(pg, y) { [[c1, X0, w1], [c2, X0 + w1 + 14, w2]].forEach(([c, x, w]) => { pg.stroke(x, y, w, h, 12, C.line, 1); let yy = y + 12; c.parts.forEach(p => { yy += p.mt || 0; p.draw(pg, x + 15, yy); yy += p.h; }); }); }});
  }
  { // the strip
    const bw = width('AGC', 800, 12, 0.72) + 22, t = para({text: clean(D.strip) || 'Site survey for AGC project managers and installation partners. All dimensions in inches. No pricing.', f: 700, s: 13, c: C.ink, lh: 16.4, w: CW - 32 - bw - 10 - 16});
    const h = 2 + 9 + Math.max(19.12, t.h) + 9 + 2;
    blocks.push({h: h, draw(pg, y) { pg.stroke(X0, y, CW, h, 12, C.green, 2); const by = y + (h - 19.12) / 2; pg.fill(X0 + 16, by, bw, 19.12, 9.56, C.green);
      pg.text('AGC', X0 + 16 + 11, by + 2, 800, 12, C.d1, 0.72, 15.12); t.draw(pg, X0 + 16 + bw + 10, y + (h - t.h) / 2); }});
  }
  // key details
  blocks.push(band('KEY DETAILS', D.kvNote || '', 'KEY DETAILS'));
  (D.kv || []).forEach(r => blocks.push(kv(r[0], r[1], 'KEY DETAILS')));
  // the project manager is the last key detail (a card at the end could push a page of its own)
  if (pm.nm) blocks.push(kv(D.pmLabel || 'Your project manager', [pm.nm, pm.em, pm.ph].filter(Boolean).map(t => String(t).replace(/ /g, '\u00a0')).join('  ·  '), 'KEY DETAILS'));

  // ---- the measured elevation: every face unfolded left to right, to scale, with dimension lines ----
  if (faces.length) {
    const sec = 'MEASURED ELEVATION';
    blocks.push(band(sec, D.elevNote || 'Wall faces shown unfolded, left to right, as seen from the front. To scale. All dimensions in inches.', sec));
    const lab0 = width(inch((D.faces[0] || {}).w), 700, 11, 0) + 12, labN = width(inch((D.faces[D.faces.length - 1] || {}).w), 700, 11, 0) + 12;
    const PADL = 30 + lab0, PADR = 30 + labN, availW = CW - PADL - PADR, sumW = faces.reduce((a, f) => a + Number(f.w), 0), maxH = Math.max(...faces.map(f => Number(f.h)));
    const sc = Math.min(availW / sumW, 200 / maxH), dw = sumW * sc, ox = X0 + PADL + (availW - dw) / 2;
    const DIM = '2f6b10', TS = 11;
    // width labels: a second row when a label is wider than its face
    let xx = ox; const wl = faces.map(f => { const fw = Number(f.w) * sc, t = inch(f.w), tw = width(t, 700, TS, 0), o = {x: xx, w: fw, t: t, tw: tw, row: 0}; xx += fw; return o; });
    wl.forEach((o, i) => { if (o.tw + 6 > o.w) o.out = i === 0 ? 'left' : i === wl.length - 1 ? 'right' : 'below'; });
    const topOverall = 14, faceTop = topOverall + 22 + 20 + 8, faceH = maxH * sc;
    const hasChain = faces.some(f => f.door) || wl.some(o => o.out === 'below'), chainH = hasChain ? 44 : 0;
    const h = 14 + faceTop + faceH + 10 + chainH + 30;
    const dimLine = (pg, x1, x2, y, t, col) => { pg.line(x1, y, x2, y, col, 0.9); pg.line(x1, y - 5, x1, y + 5, col, 0.9); pg.line(x2, y - 5, x2, y + 5, col, 0.9);
      if (t) { const tw = width(t, 700, TS, 0); const cx = (x1 + x2) / 2; if (tw + 8 < x2 - x1) pg.fill(cx - tw / 2 - 4, y - 8, tw + 8, 16, 0, C.white); pg.text(t, cx - tw / 2, y - 7.5, 700, TS, col, 0, 15); } };
    blocks.push({sec: sec, h: h, draw(pg, y0) {
      const y = y0 + 14;
      dimLine(pg, ox, ox + dw, y + topOverall, inch(sumW) + ' overall (sum of the measured faces)', DIM);
      wl.forEach(o => { const ly = y + topOverall + 22; dimLine(pg, o.x, o.x + o.w, ly, o.out ? '' : o.t, DIM);
        if (o.out === 'left') pg.text(o.t, o.x - 8 - o.tw, ly - 7.5, 700, TS, DIM, 0, 15);
        if (o.out === 'right') pg.text(o.t, o.x + o.w + 8, ly - 7.5, 700, TS, DIM, 0, 15);
        if (o.out === 'below') pg.text(o.t, o.x + (o.w - o.tw) / 2, y + faceTop + faceH + 14, 700, TS, DIM, 0, 15); });
      const fy = y + faceTop; let x = ox;
      faces.forEach((f, i) => { const fw = Number(f.w) * sc, fh = Number(f.h) * sc, top = fy + faceH - fh;
        pg.fill(x, top, fw, fh, 0, 'f7f7f7'); pg.stroke(x, top, fw, fh, 0, C.ink, 1.4);
        if (f.door) { const d = f.door, fr = Number(d.frame) || 0, dx = x + Number(d.left) * sc, dW = (Number(d.w) + 2 * fr) * sc, dH = (Number(d.h) + fr) * sc;
          pg.fill(dx, fy + faceH - dH, dW, dH, 0, 'e8f2da'); pg.stroke(dx, fy + faceH - dH, dW, dH, 0, C.ink, 1);
          if (fr) pg.stroke(dx + fr * sc, fy + faceH - dH + fr * sc, dW - 2 * fr * sc, dH - fr * sc + 0.5, 0, C.ink3, 0.6);
          const t = 'DOOR', tw = width(t, 800, 10, 0.5); if (tw + 4 < dW) pg.text(t, dx + (dW - tw) / 2, fy + faceH - dH + 6, 800, 10, C.ink, 0.5, 13);
          const hl = inch(d.h) + ' ht'; const hw = width(hl, 700, 10, 0); if (hw + 4 < dW) pg.text(hl, dx + (dW - hw) / 2, fy + faceH - dH / 2 - 6, 700, 10, DIM, 0, 13);
          // the chain below: corner to frame, frame + door + frame, frame to corner
          const cy = fy + faceH + 22, xL = x, xD = dx, xE = dx + dW, xR = x + fw;
          const dt = inch(Number(d.w) + 2 * fr), dtw = width(dt, 700, TS, 0);
          dimLine(pg, xL, xD, cy, inch(d.left), DIM); dimLine(pg, xD, xE, cy, dtw + 8 < dW ? dt : '', DIM); dimLine(pg, xE, xR, cy, inch(d.right), DIM);
          const cap = dtw + 8 < dW ? 'door + frame' : dt + ' door + frame', cw2 = width(cap, 400, 10, 0); pg.text(cap, (xD + xE) / 2 - cw2 / 2, cy + 8, 400, 10, DIM, 0, 13); }
        // the face number + its height
        const nr = String(f.k); pg.circle(x + fw / 2, fy + faceH - 16, 9.5, C.green); pg.text(nr, x + fw / 2 - width(nr, 800, 10, 0) / 2, fy + faceH - 25.5, 800, 10, C.d1, 0, 19);
        const ht = inch(f.h), htw = width(ht, 700, 10, 0); if (htw + 6 < fw) pg.text(ht, x + (fw - htw) / 2, top + 6, 700, 10, DIM, 0, 13);
        x += fw; });
      // the height of the tallest face, left of the drawing
      const hx = ox - 12; pg.line(hx, fy, hx, fy + faceH, DIM, 0.9); pg.line(hx - 5, fy, hx + 5, fy, DIM, 0.9); pg.line(hx - 5, fy + faceH, hx + 5, fy + faceH, DIM, 0.9);
      const leg = 'Green dot = face number (see the table below). Heights are written at the top of each face.';
      pg.text(leg, X0 + 16, y0 + h - 22, 400, 11, C.ink3, 0, 14);
    }});
    blocks.push(endPad(sec));
  }
  // ---- surfaces and measurements: one row per face ----
  if (faces.length) {
    const sec = 'SURFACES AND MEASUREMENTS';
    blocks.push(band(sec, D.facesNote || 'Height x width for every face, with the surface or material and what the surveyor saw', sec));
    const C1 = 225, C2 = 205, C3 = CW - C1 - C2;
    blocks.push({sec: sec, keep: true, h: 9 + 11 * LHN + 9, draw(pg, y) { pg.fill(X0, y, CW, this.h, 0, C.d2);
      pg.text('FACE', X0 + 12, y + 9, 800, 11, C.white, 1.1); pg.text('WIDTH X HEIGHT', X0 + C1 + 12, y + 9, 800, 11, C.white, 1.1); pg.text('SURFACE AND NOTES', X0 + C1 + C2 + 12, y + 9, 800, 11, C.white, 1.1); }});
    faces.forEach(f => {
      const nm = para({text: clean(f.name), f: 800, s: 14, c: C.ink, lh: 19.5, w: C1 - 24 - 28});
      const nb = t => t.replace(/ /g, '\u00a0'); const sz = para({runs: [{t: nb(inch(f.w) + ' W'), f: 800}, {t: ' x ', f: 400}, {t: nb(inch(f.h) + ' H'), f: 800}], s: 14, c: C.ink, lh: 19.5, w: C2 - 24});
      const sf = para({runs: [{t: 'Surface: ', f: 700}, {t: clean(f.surface) || TBC, f: 400}], s: 13.5, c: C.ink, lh: 19, w: C3 - 24});
      const nl = (f.notes || []).map(t => para({runs: runsOf(clean(t), 400, 700), s: 13.5, c: C.ink2, lh: 19, w: C3 - 24 - 14}));
      const rh = sf.h + nl.reduce((a, b) => a + 3 + b.h, 0), h = 11 + Math.max(20, nm.h, sz.h, rh) + 11 + 1;
      blocks.push({sec: sec, h: h, draw(pg, y) { pg.fill(X0, y + h - 1, CW, 1, 0, C.line);
        pg.circle(X0 + 22, y + 21, 10, C.green); const k = String(f.k); pg.text(k, X0 + 22 - width(k, 800, 10, 0) / 2, y + 11, 800, 10, C.d1, 0, 20);
        nm.draw(pg, X0 + 40, y + 11.75); sz.draw(pg, X0 + C1 + 12, y + 11.75); sf.draw(pg, X0 + C1 + C2 + 12, y + 12);
        let yy = y + 12 + sf.h; nl.forEach(b => { yy += 3; pg.circle(X0 + C1 + C2 + 12 + 4, yy + 9.5, 2.4, C.green); b.draw(pg, X0 + C1 + C2 + 12 + 14, yy); yy += b.h; }); }});
    });
    blocks.push(endPad(sec));
  }
  // ---- the other sections (doors and obstructions, adhesion test, access, power) ----
  // Nov 27 (Chris, Randy, Robert): hoardings never get an adhesion test section; interior office walls do
  const hoarding = /hoarding/i.test(String(D.kind || ''));
  (D.sections || []).filter(s => !(hoarding && /adhesion/i.test(s.title))).forEach(s => {
    if (s.kv) { blocks.push(band(s.title, s.note, s.title)); s.kv.forEach(r => blocks.push(kv(r[0], r[1], s.title))); blocks.push(endPad(s.title)); return; }
    section(s.title, s.note, s.items || []); });
  // ---- site photos: two per row, each keeps its shape ----
  const ph = (D.photos || []).filter(p => p && p.img);
  if (ph.length) {
    const sec = 'SITE PHOTOS';
    blocks.push(band(sec, D.photoNote || 'From the survey visit', sec));
    const NC = 3, cw = (CW - 14 * (NC - 1)) / NC, maxIH = 205;
    for (let i = 0; i < ph.length; i += NC) {
      const pair = ph.slice(i, i + NC).map((p, j) => { const r = p.h / p.w; let w = cw, h = cw * r; if (h > maxIH) { h = maxIH; w = h / r; }
        const cap = para({runs: [{t: 'Photo ' + (i + j + 1) + '  ', f: 800, c: C.gdark}, {t: clean(p.cap) || '', f: 400, c: C.ink2}], s: 11.5, lh: 15.5, w: cw}); return {p: p, w: w, h: h, cap: cap}; });
      const ih = Math.max(...pair.map(q => q.h)), chh = Math.max(...pair.map(q => q.cap.h)), h = 14 + ih + 6 + chh;
      blocks.push({sec: sec, h: h, draw(pg, y) { pair.forEach((q, j) => { const x = X0 + j * (cw + 14), ix = x + (cw - q.w) / 2, iy = y + 14 + (ih - q.h) / 2;
        pg.fill(x, y + 14, cw, ih, 10, C.soft); pg.clip(ix, iy, q.w, q.h, 8); pg.image(ix, iy, q.w, q.h, q.p.img); pg.unclip(); pg.stroke(ix, iy, q.w, q.h, 8, C.line, 1);
        q.cap.draw(pg, x, y + 14 + ih + 6); }); }});
    }
    blocks.push(endPad(sec));
  }
  // ---- notes + open questions ----
  section('NOTES', D.notesNote || 'What the surveyor and the PM need everyone to know', (D.notes || []).map(t => ({k: 'b', t: t})));
  // Nov 27 (Chris, Randy, Robert): open items are only what the CLIENT can act on; none = no section
  if ((D.questions || []).length) section(D.qTitle || 'OPEN ITEMS', D.qNote || 'For you to confirm', (D.questions || []).map((t, i) => ({k: 'num', n: i + 1, t: t})));
  if (pm.nm && D.pmCard) {
    const pl = lbl(D.pmLabel || 'Project manager', CW - 30), nm = para({text: pm.nm, f: 800, s: 15, c: C.ink, lh: 15 * LHN, w: CW - 30});
    const ct = para({text: [pm.em, pm.ph].filter(Boolean).join('  ·  '), f: 400, s: 13.5, c: C.ink2, lh: 13.5 * LHN, w: CW - 30}), h = 12 + pl.h + 3 + nm.h + 2 + ct.h + 12;
    blocks.push({gap: true, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 12, C.soft); pg.stroke(X0, y, CW, h, 12, C.line, 1); let ly = y + 12; pl.draw(pg, X0 + 15, ly); ly += pl.h + 3; nm.draw(pg, X0 + 15, ly); ly += nm.h + 2; ct.draw(pg, X0 + 15, ly);
      if (pm.em) pg.link(X0 + 15, ly, width(pm.em, 400, 13.5, 0), 17, 'mailto:' + pm.em); }});
  }

  // ---- pagination (same rules as the brief) ----
  blocks.forEach((b, i) => { if (!b.band) return; let h = 0; for (let j = i; j < blocks.length && (j === i || !blocks[j].band) && !(j > i && blocks[j].gap); j++) h += blocks[j].h; b.sh = h; });
  const layout = forced => { const pl = []; let p = 0, y = P1_TOP, has = false;
    const brk = (b) => { p++; y = TOP; has = false; if (b.sec && !b.band) { const cb = contBand(b.sec); pl.push({b: cb, p: p, y: y}); y += cb.h; has = true; } };
    blocks.forEach((b, i) => {
      let keepH = 0; for (let j = i; blocks[j].keep && blocks[j + 1]; j++) keepH += blocks[j + 1].h; // a band, its table head and the first row stay together
      const g = has && b.gap ? GAP : 0;
      if (b.band && has && b.sh <= 200 && y + GAP + b.sh > BOT && !forced.has(i)) brk(b);
      if (b.end && has && y + b.h > BOT) return;
      if (forced.has(i) || (has && y + g + b.h + keepH > BOT)) brk(b);
      if (has && b.gap) y += GAP;
      pl.push({b: b, p: p, y: y, i: i}); y += b.h; has = true; });
    return {pl: pl, n: p + 1, endY: y}; };
  const forced = new Set(); let lay = layout(forced);
  for (let guard = 0; guard < 50 && lay.endY > BOT_LAST; guard++) {
    const last = lay.pl.filter(q => q.p === lay.n - 1 && q.i != null);
    let j = last.findIndex(q => q.y + q.b.h > BOT_LAST - 0.01); if (j < 0) break;
    while (j > 0 && last[j - 1].b.keep) j--;
    if (j === 0) break; forced.add(last[j].i); lay = layout(forced); }
  const pages = []; for (let i = 0; i < lay.n; i++) pages.push(new Page());
  drawHeader(pages[0]); drawFooter(pages[pages.length - 1]);
  lay.pl.forEach(q => q.b.draw(pages[q.p], q.y));
  return pages;
}
const surveyName = D => D.fn ? String(D.fn) : 'AGC ' + D.n + ' - SITE SURVEY.pdf';
// photos: [{data: Uint8Array (baseline JPEG), w, h, cap}] -> embedded as /Ph1, /Ph2...
async function makeSurvey(D, fetchFn, photos) {
  const get = async f => { const r = await fetchFn(ASSET + f); if (!r.ok) throw new Error('could not load ' + f + ' (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); };
  const [a, b, c, mark] = await Promise.all([get('wmd-400.ttf'), get('wmd-700.ttf'), get('wmd-800.ttf'), get('agc-mark-dark.jpg')]);
  const imgs = (photos || []).map(p => ({data: p.data, w: p.w, h: p.h}));
  const A = {fonts: {400: a, 700: b, 800: c}, mark: mark, markW: 232, markH: 232, imgs: imgs};
  D = Object.assign({}, D, {photos: (photos || []).map((p, i) => ({img: 'Ph' + (i + 1), w: p.w, h: p.h, cap: p.cap}))});
  const pages = buildSurvey(D, A), name = surveyName(D);
  return {bytes: file(pages, A, name.replace(/\.pdf$/, '')), name: name, pages: pages.length};
}

// ---- the PDF file ----
function file(pages, A, title) {
  const parts = [], offs = []; let len = 0;
  const add = x => { const b = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x; parts.push(b); len += b.length; };
  const pstr = s => '(' + String(s).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1') + ')';
  const obj = (n, body, stream) => { offs[n] = len; add(n + ' 0 obj\n'); if (stream) { add(body.replace('>>', '/Length ' + stream.length + ' >>') + '\nstream\n'); add(stream); add('\nendstream\nendobj\n'); } else add(body + '\nendobj\n'); };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const F = [400, 700, 800], NAME = {400: 'ABCDEF+WixMadeforDisplay-Regular', 700: 'ABCDEG+WixMadeforDisplay-Bold', 800: 'ABCDEH+WixMadeforDisplay-ExtraBold'};
  const nPages = pages.length; let n = 3; const fontObj = {};
  F.forEach(f => { const fo = n++, fd = n++, ff = n++; fontObj[f] = fo; const m = M[f];
    obj(fo, '<< /Type /Font /Subtype /TrueType /BaseFont /' + NAME[f] + ' /FirstChar 32 /LastChar 255 /Widths [' + m.w.join(' ') + '] /Encoding /WinAnsiEncoding /FontDescriptor ' + fd + ' 0 R >>');
    obj(fd, '<< /Type /FontDescriptor /FontName /' + NAME[f] + ' /Flags 32 /FontBBox [' + m.bbox.join(' ') + '] /ItalicAngle 0 /Ascent ' + m.asc + ' /Descent ' + m.dsc + ' /CapHeight ' + m.cap + ' /StemV ' + (f === 400 ? 80 : 140) + ' /FontFile2 ' + ff + ' 0 R >>');
    obj(ff, '<< /Length1 ' + A.fonts[f].length + ' >>', A.fonts[f]); });
  const im = n++; obj(im, '<< /Type /XObject /Subtype /Image /Width ' + A.markW + ' /Height ' + A.markH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>', A.mark);
  let xo = '/Im1 ' + im + ' 0 R'; (A.imgs || []).forEach((g, i) => { const o = n++; obj(o, '<< /Type /XObject /Subtype /Image /Width ' + g.w + ' /Height ' + g.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>', g.data); xo += ' /Ph' + (i + 1) + ' ' + o + ' 0 R'; });
  const kids = [];
  pages.forEach(p => { const po = n++, co = n++; kids.push(po); const content = p.ops.join('\n');
    const an = p.links.map(l => { const a = n++; obj(a, '<< /Type /Annot /Subtype /Link /Rect [' + l.slice(0, 4).map(v => v.toFixed(2)).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI ' + pstr(l[4]) + ' >> >>'); return a; });
    obj(po, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F400 ' + fontObj[400] + ' 0 R /F700 ' + fontObj[700] + ' 0 R /F800 ' + fontObj[800] + ' 0 R >> /XObject << ' + xo + ' >> >> /Contents ' + co + ' 0 R' + (an.length ? ' /Annots [' + an.map(a => a + ' 0 R').join(' ') + ']' : '') + ' >>');
    obj(co, '<< >>', Uint8Array.from(content, c => c.charCodeAt(0) & 255)); });
  const info = n++; obj(info, '<< /Title ' + pstr(title) + ' /Author (American Graphic Contractors LLC) /Creator (AGC PDF) /Producer (AGC PDF) >>');
  obj(1, '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>');
  obj(2, '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + nPages + ' >>');
  const xref = len; let x = 'xref\n0 ' + n + '\n0000000000 65535 f \n'; for (let i = 1; i < n; i++) x += String(offs[i] || 0).padStart(10, '0') + ' 00000 n \n';
  add(x + 'trailer\n<< /Size ' + n + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  const out = new Uint8Array(len); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out;
}
// the estimate's data from its link (#d=<base64url of UTF-8 JSON>)
function fromLink(url) {
  const m = String(url || '').match(/[#&?]d=([A-Za-z0-9_-]+)/); if (!m) return null;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', s = m[1], bytes = []; let buf = 0, bits = 0;
  for (const ch of s) { const v = A.indexOf(ch); if (v < 0) continue; buf = (buf << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 255); } }
  let str = '', i = 0; while (i < bytes.length) { const b = bytes[i++]; let cp;
    if (b < 128) cp = b; else if (b >> 5 === 6) cp = ((b & 31) << 6) | (bytes[i++] & 63); else if (b >> 4 === 14) { cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63); }
    else { cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63); } str += String.fromCodePoint(cp); }
  return JSON.parse(str);
}
const fileName = D => D.fn ? String(D.fn) : 'AGC ' + D.n + ' - ESTIMATE - ' + (Number(D.r) || 1) + '.pdf';
// make(D, fetchFn) -> {bytes, name, pages}; the fonts and the icon come from the AGC GitHub page
async function make(D, fetchFn) {
  const get = async f => { const r = await fetchFn(ASSET + f); if (!r.ok) throw new Error('could not load ' + f + ' (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); };
  const [a, b, c, mark] = await Promise.all([get('wmd-400.ttf'), get('wmd-700.ttf'), get('wmd-800.ttf'), get('agc-mark-dark.jpg')]);
  const A = {fonts: {400: a, 700: b, 800: c}, mark: mark, markW: 232, markH: 232};
  const pages = build(D, A), name = fileName(D);
  return {bytes: file(pages, A, name.replace(/\.pdf$/, '')), name: name, pages: pages.length};
}
const briefName = D => D.fn ? String(D.fn) : 'AGC ' + D.n + ' - PROJECT BRIEF.pdf';
async function makeBrief(D, fetchFn) {
  const get = async f => { const r = await fetchFn(ASSET + f); if (!r.ok) throw new Error('could not load ' + f + ' (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); };
  const [a, b, c, mark] = await Promise.all([get('wmd-400.ttf'), get('wmd-700.ttf'), get('wmd-800.ttf'), get('agc-mark-dark.jpg')]);
  const A = {fonts: {400: a, 700: b, 800: c}, mark: mark, markW: 232, markH: 232};
  const pages = buildBrief(D, A), name = briefName(D);
  return {bytes: file(pages, A, name.replace(/\.pdf$/, '')), name: name, pages: pages.length};
}
return {make, fromLink, fileName, build, file, makeBrief, parseAssist, briefName, makeSurvey, buildSurvey, surveyName, inch};
})();

if (typeof module !== 'undefined') module.exports = AGC_PDF;
