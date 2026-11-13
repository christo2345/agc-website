// 🧾 AGC ESTIMATE PDF (Nov 13 2026): draws the same estimate as the digital page (estimate/index.html), as a real PDF file.
// Plain JavaScript with no libraries (it runs inside an Airtable script). Letter pages, the header on every page, the footer at the bottom.
// The fonts (Wix Madefor Display, SIL Open Font License) and the AGC icon are read from the AGC GitHub page.
const AGC_PDF = (() => {
const M = /*METRICS*/null;
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
Page.prototype.image = function (x, y, w, h) { this.ops.push('q ' + n2(w) + ' 0 0 ' + n2(h) + ' ' + n2(x) + ' ' + n2(PH - y - h) + ' cm /Im1 Do Q'); };
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
  lines.forEach(L => { const info = !(Number(L.a) > 0) && L.i; if (!info) { k++; sub += Number(L.a) || 0; } rows.push({L: L, info: !!info, k: k}); });
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
  { // terms + totals
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
  blocks.forEach(b => {
    if (b.row) {
      const need = (inTable ? 0 : (hasBlock ? GAP : 0) + THEAD.h) + b.h;
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
  const kids = [];
  pages.forEach(p => { const po = n++, co = n++; kids.push(po); const content = p.ops.join('\n');
    const an = p.links.map(l => { const a = n++; obj(a, '<< /Type /Annot /Subtype /Link /Rect [' + l.slice(0, 4).map(v => v.toFixed(2)).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI ' + pstr(l[4]) + ' >> >>'); return a; });
    obj(po, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F400 ' + fontObj[400] + ' 0 R /F700 ' + fontObj[700] + ' 0 R /F800 ' + fontObj[800] + ' 0 R >> /XObject << /Im1 ' + im + ' 0 R >> >> /Contents ' + co + ' 0 R' + (an.length ? ' /Annots [' + an.map(a => a + ' 0 R').join(' ') + ']' : '') + ' >>');
    obj(co, '<< >>', Uint8Array.from(content, c => c.charCodeAt(0) & 255)); });
  const info = n++; obj(info, '<< /Title ' + pstr(title) + ' /Author (American Graphic Contractors LLC) /Creator (AGC Estimate Builder) /Producer (AGC Estimate Builder) >>');
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
const fileName = D => 'AGC ' + D.n + ' - ESTIMATE - ' + (Number(D.r) || 1) + '.pdf';
// make(D, fetchFn) -> {bytes, name, pages}; the fonts and the icon come from the AGC GitHub page
async function make(D, fetchFn) {
  const get = async f => { const r = await fetchFn(ASSET + f); if (!r.ok) throw new Error('could not load ' + f + ' (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); };
  const [a, b, c, mark] = await Promise.all([get('wmd-400.ttf'), get('wmd-700.ttf'), get('wmd-800.ttf'), get('agc-mark-dark.jpg')]);
  const A = {fonts: {400: a, 700: b, 800: c}, mark: mark, markW: 232, markH: 232};
  const pages = build(D, A), name = fileName(D);
  return {bytes: file(pages, A, name.replace(/\.pdf$/, '')), name: name, pages: pages.length};
}
return {make, fromLink, fileName, build, file};
})();
