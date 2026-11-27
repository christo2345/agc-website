// ===================== 📐 SITE SURVEY PDF · build (AGC PROJECTS) =====================
// Nov 27, 2026 (Chris, Randy, Robert approved version 2 on AGC 19161). When 📐 BUILD SITE SURVEY is ticked:
// reads 📐 SITE SURVEY DATA (JSON written by Alfred or the PM), the survey photos named in it (JPEGs on this project, or public JPEG links),
// builds the client-facing site survey PDF on the same engine as the estimate and the project brief (fonts from the AGC website),
// puts it in a review copy draft in the PM's Missive (no recipient, never sent), saves it in 📐 SITE SURVEY PDF, writes 📐 SITE SURVEY CHECK
// and unticks the box. Hoardings never get an adhesion test section. Open items = only what the client can act on.
// Skips hands-off projects 17329, 17334, 19043, 19072. No AI credits. Nothing is ever sent to a client.
const c = input.config();
// 📐 the PDF engine, inline (same engine and fonts as the estimate and the project brief; published copy on the AGC website: estimate/pdf/survey-pdf.js)
const AGC_PDF = (() => {
const M = {"400":{"w":[195,222,352,660,660,756,677,222,316,316,412,660,222,334,222,484,646,456,598,599,646,592,622,594,624,622,222,222,660,660,660,561,1057,727,666,739,741,603,578,797,742,247,645,687,564,900,738,852,644,852,687,679,625,722,711,1052,668,647,609,313,484,313,660,500,584,550,633,545,633,601,380,633,584,214,214,547,214,921,584,614,633,633,364,514,392,582,537,772,508,537,488,389,214,389,660,0,660,0,222,0,362,1000,0,0,584,0,0,318,1235,0,0,0,0,222,222,362,362,354,500,1000,584,883,0,318,1033,0,0,0,195,222,660,660,632,660,214,596,584,852,458,502,660,334,526,584,448,660,428,405,584,660,624,222,584,366,506,502,939,980,977,561,727,727,727,727,727,727,1043,739,603,603,603,603,247,247,247,247,741,738,852,852,852,852,852,660,852,722,722,722,722,647,644,622,550,550,550,550,550,550,963,545,601,601,601,601,214,214,214,214,614,584,614,614,614,614,614,660,614,582,582,582,582,537,633,537],"asc":1008,"dsc":-252,"bbox":[-176,-255,1190,967],"cap":715},"700":{"w":[195,261,429,704,660,802,706,262,343,343,441,660,262,336,262,505,655,487,598,622,667,613,636,603,644,636,262,262,660,660,660,576,1024,771,675,752,755,619,592,810,753,277,676,738,576,917,758,864,657,864,708,699,648,740,759,1072,723,711,644,327,505,327,660,500,600,574,651,567,651,610,411,651,600,249,249,605,249,918,600,636,651,651,398,541,420,598,591,826,573,591,519,393,237,393,660,0,660,0,262,0,451,1000,0,0,600,0,0,365,1220,0,0,0,0,262,262,451,451,354,500,1000,600,917,0,365,1029,0,0,0,195,261,660,660,587,660,237,577,600,852,476,592,660,336,528,600,477,660,397,400,600,660,650,262,600,365,526,592,944,976,979,576,771,771,771,771,771,771,1079,752,619,619,619,619,277,277,277,277,755,758,864,864,864,864,864,660,864,740,740,740,740,711,657,648,574,574,574,574,574,574,968,567,610,610,610,610,249,249,249,249,636,600,636,636,636,636,636,660,641,598,598,598,598,591,651,591],"asc":1008,"dsc":-252,"bbox":[-219,-261,1175,988],"cap":715},"800":{"w":[195,286,478,732,660,831,725,288,360,360,459,660,288,338,288,519,660,506,598,637,681,627,645,608,656,645,288,288,660,660,660,586,1003,799,680,761,764,629,601,819,760,296,696,771,584,928,770,872,666,872,722,711,662,752,789,1084,758,752,666,336,519,336,660,500,611,590,663,581,663,616,430,663,611,271,271,642,271,916,611,650,663,663,419,558,438,609,625,860,614,625,539,396,252,396,660,0,660,0,288,0,507,1000,0,0,611,0,0,395,1211,0,0,0,0,288,288,507,507,354,500,1000,611,939,0,395,1027,0,0,0,195,286,660,660,558,660,252,565,611,852,487,649,660,338,530,611,495,660,377,397,611,660,667,288,611,365,538,649,948,973,980,586,799,799,799,799,799,799,1102,761,629,629,629,629,296,296,296,296,764,770,872,872,872,872,872,660,872,752,752,752,752,752,666,664,590,590,590,590,590,590,972,581,616,616,616,616,271,271,271,271,650,611,650,650,650,650,650,660,658,609,609,609,609,625,663,625],"asc":1008,"dsc":-252,"bbox":[-246,-265,1166,1002],"cap":715}};
const ASSET = 'https://christo2345.github.io/agc-website/estimate/pdf/';
const PW = 816, PH = 1056; // the page in CSS px (8.5 x 11 in at 96 px per inch); drawn at 0.75 pt per px
const LHN = 1.26; // 'normal' line height of the font
const C = {green: '92C64B', gdark: '4f7f1d', soft: 'f4f4f4', ink: '141414', ink2: '262626', ink3: '474747', line: 'e2e2e2', d1: '0d0d0d', d2: '161616', white: 'ffffff'};
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
Page.prototype.text = function (s, x, top, f, size, col, ls, lh) { const b = enc(s); if (!b.length) return;
  const base = top + ((lh || size * LHN) - size * LHN) / 2 + size * M[f].asc / 1000;
  this.ops.push('BT /F' + f + ' ' + n2(size) + ' Tf ' + n2(ls || 0) + ' Tc ' + hex(col) + ' rg 1 0 0 1 ' + n2(x) + ' ' + n2(PH - base) + ' Tm <' + b.map(v => (v < 16 ? '0' : '') + v.toString(16)).join('') + '> Tj ET'); };
Page.prototype.link = function (x, y, w, h, uri) { this.links.push([x * .75, (PH - y - h) * .75, (x + w) * .75, (PH - y) * .75, uri]); };
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

const clean = s => String(s == null ? '' : s)
  .replace(/\p{Extended_Pictographic}️?/gu, '')
  .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
  .replace(/\s+[–—]\s+/g, ': ').replace(/[–—]/g, ', ')
  .replace(/\s*→\s*/g, ', then ')
  .replace(/[ \t]+$/gm, '').replace(/ {2,}/g, ' ').trim();
const runsOf = (s, f0, fb) => { const out = []; String(s).split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; const b = /^\*\*.*\*\*$/.test(p); out.push({t: b ? p.slice(2, -2) : p, f: b ? fb : f0}); }); return out.length ? out : [{t: '', f: f0}]; };
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

  const addr = String(D.ad || '#30 N Gould St Ste R, Sheridan, WY 82801, USA');
  const addrW = width(addr, 400, 12.5, 0.2), coW17 = width('AMERICAN GRAPHIC CONTRACTORS LLC', 800, 17, 0.68);
  const coS = 17 * addrW / coW17, wordH = coS * 1.2 + 5 + 12.5 * 1.2, brandH = Math.max(58, wordH);
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
  const FH = 12 * 2 + 12 * LHN, EM = 'projects@americangraphiccontractors.com';
  const foot = para({runs: [{t: 'americangraphiccontractors.com', f: 700, c: C.green}, {t: '  ·  ' + EM + '  ·  1 (877) 395-7435', f: 400, c: 'e6e6e6'}], s: 12, ls: 0.15, nowrap: true});
  const drawFooter = pg => { pg.fill(0, PH - FH, PW, FH, 0, C.d1); const x = (PW - foot.w) / 2, y = PH - FH + 12; foot.draw(pg, x, y, foot.w);
    const w1 = foot.lines[0].segs[0].w; pg.link(x, y, w1, 15.1, 'https://americangraphiccontractors.com');
    pg.link(x + w1 + width('  ·  ', 400, 12, 0.15), y, width(EM, 400, 12, 0.15), 15.1, 'mailto:' + EM); };
  const P1_TOP = HX + HH + 18, TOP = MARGIN, BOT = PH - MARGIN, BOT_LAST = PH - FH - 16;

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
  blocks.push(band('KEY DETAILS', D.kvNote || '', 'KEY DETAILS'));
  (D.kv || []).forEach(r => blocks.push(kv(r[0], r[1], 'KEY DETAILS')));
  if (pm.nm) blocks.push(kv(D.pmLabel || 'Your project manager', [pm.nm, pm.em, pm.ph].filter(Boolean).map(t => String(t).replace(/ /g, '\u00a0')).join('  ·  '), 'KEY DETAILS'));

  if (faces.length) {
    const sec = 'MEASURED ELEVATION';
    blocks.push(band(sec, D.elevNote || 'Wall faces shown unfolded, left to right, as seen from the front. To scale. All dimensions in inches.', sec));
    const lab0 = width(inch((D.faces[0] || {}).w), 700, 11, 0) + 12, labN = width(inch((D.faces[D.faces.length - 1] || {}).w), 700, 11, 0) + 12;
    const PADL = 30 + lab0, PADR = 30 + labN, availW = CW - PADL - PADR, sumW = faces.reduce((a, f) => a + Number(f.w), 0), maxH = Math.max(...faces.map(f => Number(f.h)));
    const sc = Math.min(availW / sumW, 200 / maxH), dw = sumW * sc, ox = X0 + PADL + (availW - dw) / 2;
    const DIM = '2f6b10', TS = 11;
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
          const cy = fy + faceH + 22, xL = x, xD = dx, xE = dx + dW, xR = x + fw;
          const dt = inch(Number(d.w) + 2 * fr), dtw = width(dt, 700, TS, 0);
          dimLine(pg, xL, xD, cy, inch(d.left), DIM); dimLine(pg, xD, xE, cy, dtw + 8 < dW ? dt : '', DIM); dimLine(pg, xE, xR, cy, inch(d.right), DIM);
          const cap = dtw + 8 < dW ? 'door + frame' : dt + ' door + frame', cw2 = width(cap, 400, 10, 0); pg.text(cap, (xD + xE) / 2 - cw2 / 2, cy + 8, 400, 10, DIM, 0, 13); }
        const nr = String(f.k); pg.circle(x + fw / 2, fy + faceH - 16, 9.5, C.green); pg.text(nr, x + fw / 2 - width(nr, 800, 10, 0) / 2, fy + faceH - 25.5, 800, 10, C.d1, 0, 19);
        const ht = inch(f.h), htw = width(ht, 700, 10, 0); if (htw + 6 < fw) pg.text(ht, x + (fw - htw) / 2, top + 6, 700, 10, DIM, 0, 13);
        x += fw; });
      const hx = ox - 12; pg.line(hx, fy, hx, fy + faceH, DIM, 0.9); pg.line(hx - 5, fy, hx + 5, fy, DIM, 0.9); pg.line(hx - 5, fy + faceH, hx + 5, fy + faceH, DIM, 0.9);
      const leg = 'Green dot = face number (see the table below). Heights are written at the top of each face.';
      pg.text(leg, X0 + 16, y0 + h - 22, 400, 11, C.ink3, 0, 14);
    }});
    blocks.push(endPad(sec));
  }
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
  const hoarding = /hoarding/i.test(String(D.kind || ''));
  (D.sections || []).filter(s => !(hoarding && /adhesion/i.test(s.title))).forEach(s => {
    if (s.kv) { blocks.push(band(s.title, s.note, s.title)); s.kv.forEach(r => blocks.push(kv(r[0], r[1], s.title))); blocks.push(endPad(s.title)); return; }
    section(s.title, s.note, s.items || []); });
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
  section('NOTES', D.notesNote || 'What the surveyor and the PM need everyone to know', (D.notes || []).map(t => ({k: 'b', t: t})));
  if ((D.questions || []).length) section(D.qTitle || 'OPEN ITEMS', D.qNote || 'For you to confirm', (D.questions || []).map((t, i) => ({k: 'num', n: i + 1, t: t})));
  if (pm.nm && D.pmCard) {
    const pl = lbl(D.pmLabel || 'Project manager', CW - 30), nm = para({text: pm.nm, f: 800, s: 15, c: C.ink, lh: 15 * LHN, w: CW - 30});
    const ct = para({text: [pm.em, pm.ph].filter(Boolean).join('  ·  '), f: 400, s: 13.5, c: C.ink2, lh: 13.5 * LHN, w: CW - 30}), h = 12 + pl.h + 3 + nm.h + 2 + ct.h + 12;
    blocks.push({gap: true, h: h, draw(pg, y) { pg.fill(X0, y, CW, h, 12, C.soft); pg.stroke(X0, y, CW, h, 12, C.line, 1); let ly = y + 12; pl.draw(pg, X0 + 15, ly); ly += pl.h + 3; nm.draw(pg, X0 + 15, ly); ly += nm.h + 2; ct.draw(pg, X0 + 15, ly);
      if (pm.em) pg.link(X0 + 15, ly, width(pm.em, 400, 13.5, 0), 17, 'mailto:' + pm.em); }});
  }

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
async function makeSurvey(D, fetchFn, photos) {
  const get = async f => { const r = await fetchFn(ASSET + f); if (!r.ok) throw new Error('could not load ' + f + ' (' + r.status + ')'); return new Uint8Array(await r.arrayBuffer()); };
  const [a, b, c, mark] = await Promise.all([get('wmd-400.ttf'), get('wmd-700.ttf'), get('wmd-800.ttf'), get('agc-mark-dark.jpg')]);
  const imgs = (photos || []).map(p => ({data: p.data, w: p.w, h: p.h}));
  const A = {fonts: {400: a, 700: b, 800: c}, mark: mark, markW: 232, markH: 232, imgs: imgs};
  D = Object.assign({}, D, {photos: (photos || []).map((p, i) => ({img: 'Ph' + (i + 1), w: p.w, h: p.h, cap: p.cap}))});
  const pages = buildSurvey(D, A), name = surveyName(D);
  return {bytes: file(pages, A, name.replace(/\.pdf$/, '')), name: name, pages: pages.length};
}

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
return {file, makeSurvey, buildSurvey, surveyName, inch};
})();
const S = v => (v == null ? '' : String(v)).trim();
const API = 'https://public.missiveapp.com/v1';
const P = base.getTable('tblziZ2NmNH2m3HfJ');
const F = {n: 'fldun3cFC3XoZgKbq', t: 'fldX3JuLARQL4lEek', pm: 'fldrb3xNJ25Q9pe3t', data: 'fldKxjE9lgRaa7Wik', build: 'fldAzRvN3074qLP0l', pdf: 'fldIReB55dOLWaER8', check: 'fld5xwu0TeKDRKsbo'};
const HANDS_OFF = ['17329', '17334', '19043', '19072'];
const PMS = {randall: {nm: 'Randall Moffatt', ph: '(917) 410-0970', key: 'MISSIVE_TOKEN_RANDY'}, robert: {nm: 'Robert Newell', ph: '(917) 397-0230', key: 'MISSIVE_TOKEN_ROBERT'}, christian: {nm: 'Christian Maassen', ph: '', key: 'MISSIVE_TOKEN'}};
const H = k => ({'Authorization': 'Bearer ' + input.secret(k), 'Content-Type': 'application/json'});
const b64 = buf => { const b = new Uint8Array(buf), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let o = '';
  for (let i = 0; i < b.length; i += 3) { const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    o += A[n >> 18 & 63] + A[n >> 12 & 63] + (i + 1 < b.length ? A[n >> 6 & 63] : '=') + (i + 2 < b.length ? A[n & 63] : '='); } return o; };
const jpgSize = b => { if (b[0] !== 0xFF || b[1] !== 0xD8) return null; let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1];
  if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; } const L = (b[i + 2] << 8) | b[i + 3];
  if (m >= 0xC0 && m <= 0xC3) return {h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8]}; i += 2 + L; } return null; };
const stamp = () => { try { return new Date().toLocaleString('en-US', {timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) + ' CT'; } catch (e) { return new Date().toISOString().slice(0, 16); } };

async function main() {
  const af = P.fields.filter(f => f.type === 'multipleAttachments');
  const r = await P.selectRecordAsync(S(c.recordId), {fields: [...Object.values(F), ...af.map(f => f.id).filter(id => id !== F.pdf)]});
  if (!r) return {done: false, msg: '❌ project not found'};
  const n = S(r.getCellValueAsString(F.n));
  if (HANDS_OFF.includes(n)) return {done: false, msg: '⛔ AGC ' + n + ' is a hands-off project: nothing made'};
  let raw = S(r.getCellValueAsString(F.data)).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  if (!raw) return {done: false, msg: '⚠️ 📐 SITE SURVEY DATA is empty. Ask Alfred: "make the site survey PDF for AGC ' + n + '"'};
  let D; try { D = JSON.parse(raw); } catch (e) { return {done: false, msg: '❌ 📐 SITE SURVEY DATA is not valid JSON: ' + S(e.message).slice(0, 120)}; }
  const title = S(r.getCellValueAsString(F.t)).replace(/^\s*[\d() a-z]+\s*\/\s*/i, '');
  D.n = D.n || n; D.t = D.t || title; D.fn = D.fn || ('AGC ' + n + ' - SITE SURVEY.pdf');
  const pmName = S(r.getCellValueAsString(F.pm)), pk = Object.keys(PMS).find(k => new RegExp(k, 'i').test(pmName)), pmInfo = pk ? PMS[pk] : null;
  if (!D.pm || !D.pm.nm) D.pm = {nm: pmInfo ? pmInfo.nm : (pmName || 'American Graphic Contractors'), em: 'projects@americangraphiccontractors.com', ph: pmInfo ? pmInfo.ph : ''};
  // the photos: an attachment id on this project (smaller 'large' thumbnail when there is one) or a public JPEG link
  const atts = []; af.forEach(f => (r.getCellValue(f) || []).forEach(a => atts.push(a)));
  const photos = [], skipped = [];
  for (const p of (Array.isArray(D.photos) ? D.photos : []).slice(0, 12)) {
    try {
      let url = S(p.url), nm = S(p.att);
      if (p.att) { const a = atts.find(x => x.id === S(p.att)); if (!a) { skipped.push(nm + ' (not on this project)'); continue; } nm = S(a.filename);
        url = S(a.thumbnails && a.thumbnails.large && a.thumbnails.large.url) || S(a.url); }
      if (!/^https:\/\//.test(url)) { skipped.push((nm || 'photo') + ' (no link)'); continue; }
      let rr = await fetch(url), buf = rr.ok ? new Uint8Array(await rr.arrayBuffer()) : null, sz = buf && jpgSize(buf);
      if (!sz && p.att) { const a = atts.find(x => x.id === S(p.att)); if (a && a.url && a.url !== url) { rr = await fetch(a.url); buf = rr.ok ? new Uint8Array(await rr.arrayBuffer()) : null; sz = buf && jpgSize(buf); } }
      if (!sz) { skipped.push((nm || url.slice(0, 40)) + ' (not a JPEG)'); continue; }
      if (buf.length > 6e6) { skipped.push(nm + ' (too big)'); continue; }
      photos.push({data: buf, w: sz.w, h: sz.h, cap: S(p.cap)});
    } catch (e) { skipped.push(S(p.att || p.url).slice(0, 30) + ' (' + S(e && e.message || e).slice(0, 40) + ')'); }
  }
  const pdf = await AGC_PDF.makeSurvey(D, u => fetch(u), photos);
  if (!pdf.bytes || pdf.bytes.length < 1000) throw new Error('the PDF came out empty');
  if (S(c.mode) === 'preview') return {done: false, msg: '👀 PREVIEW: ' + pdf.name + ' · ' + pdf.pages + ' pages · ' + photos.length + ' photos' + (skipped.length ? ' · skipped ' + skipped.join(', ') : '') + ' · nothing saved'};
  // the review copy: a draft in the PM's Missive with the PDF (no recipient, never sent); its file link is saved on the project
  let key = pmInfo ? pmInfo.key : 'MISSIVE_TOKEN'; try { input.secret(key); } catch (e) { key = 'MISSIVE_TOKEN'; }
  const body = '<p><b>Review copy of the site survey PDF for AGC ' + n + (D.t ? ' / ' + D.t : '') + '.</b></p><p>It is also saved on the project in 📐 SITE SURVEY PDF. Check it, then attach it to your email to the client. This draft has no recipient and is never sent; delete it when you are done.</p>';
  const d = {subject: '📐 SITE SURVEY PDF · AGC ' + n + ' · review copy', body: body, from_field: {address: 'projects@americangraphiccontractors.com', name: 'American Graphic Contractors'}, attachments: [{base64_data: b64(pdf.bytes), filename: pdf.name}]};
  let res = await fetch(API + '/drafts', {method: 'POST', headers: H(key), body: JSON.stringify({drafts: d})});
  if (!res.ok && key !== 'MISSIVE_TOKEN') { key = 'MISSIVE_TOKEN'; res = await fetch(API + '/drafts', {method: 'POST', headers: H(key), body: JSON.stringify({drafts: d})}); }
  if (!res.ok) throw new Error('Missive draft failed ' + res.status + ': ' + S(await res.text()).slice(0, 200));
  let cid = '', draftObj = null; try { const j = await res.json(); const x = Array.isArray(j.drafts) ? j.drafts[0] : j.drafts; draftObj = x; cid = S(x && x.conversation && (x.conversation.id || x.conversation)); } catch (e) {}
  const pick = list => { const a = (list || []).find(x => x && S(x.filename) === pdf.name && x.url); return a ? S(a.url) : ''; };
  let url = pick(draftObj && draftObj.attachments);
  if (!url && draftObj && draftObj.id) { const mr = await fetch(API + '/messages/' + encodeURIComponent(draftObj.id), {headers: H(key)}); if (mr.ok) { const mj = await mr.json(); const m = Array.isArray(mj.messages) ? mj.messages[0] : mj.messages; url = pick(m && m.attachments); } }
  if (!url && cid) { const cr = await fetch(API + '/conversations/' + encodeURIComponent(cid) + '/messages?limit=5', {headers: H(key)}); if (cr.ok) { const cj = await cr.json(); for (const m of (cj.messages || [])) { url = pick(m.attachments); if (url) break; } } }
  let saved = '';
  if (url) { const pr = await P.selectRecordAsync(r.id, {fields: [F.pdf]}); const keep = (pr.getCellValue(F.pdf) || []).filter(x => S(x.filename) !== pdf.name).map(x => ({id: x.id, url: x.url, filename: x.filename}));
    await P.updateRecordAsync(r.id, {[F.pdf]: [...keep, {url: url, filename: pdf.name}]}); saved = 'saved in 📐 SITE SURVEY PDF'; }
  else saved = '⚠️ NOT saved on the project (Missive gave no file link): take it from the review draft';
  const who = {MISSIVE_TOKEN_RANDY: 'Randy', MISSIVE_TOKEN_ROBERT: 'Robert', MISSIVE_TOKEN: 'Chris'}[key];
  return {done: true, msg: (url ? '✅ ' : '⚠️ ') + stamp() + ' · ' + pdf.name + ' · ' + pdf.pages + ' page' + (pdf.pages > 1 ? 's' : '') + ' · ' + photos.length + ' photo' + (photos.length === 1 ? '' : 's') +
    (skipped.length ? ' · ⚠️ photos skipped: ' + skipped.join(', ') : '') + ' · ' + saved + ' · review copy in ' + who + "'s Missive drafts" + (cid ? ': https://mail.missiveapp.com/#inbox/conversations/' + cid : '') + ' (no recipient, never sent)'};
}
let out;
try { out = await main(); } catch (e) { console.log(e && e.stack || e); out = {done: false, msg: '❌ ' + stamp() + ' · ' + S(e && e.message || e).slice(0, 300)}; }
try { const pr = await P.selectRecordAsync(S(c.recordId), {fields: [F.check]}); const prev = pr ? S(pr.getCellValueAsString(F.check)) : '';
  await P.updateRecordAsync(S(c.recordId), {[F.build]: false, [F.check]: (out.msg + (prev ? '\n' + prev : '')).slice(0, 5000)}); } catch (e) { console.log('write back: ' + e); }
console.log(out.msg);
output.set('result', out.msg);
