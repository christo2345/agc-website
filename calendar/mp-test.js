const SHEET_STORES = [];
// MULTI PARSE - read the email ATTACHMENTS so store lists sent as Excel / Word / PDF / CSV are found too.
// Supported: .xlsx .xlsm .csv .txt .docx .pdf (text PDFs). Not supported: old .xls, scanned/image PDFs, pictures.
// Excel: every visible sheet; if the client FILTERED a sheet (hidden rows), only the rows left visible are used.
// Files are unzipped with a built-in pure-JS decoder (Airtable's runtime can't be relied on for DecompressionStream).
const c = {};
const S = v => (v == null ? '' : String(v)).trim();
const LIMIT = 45000;
const xmlText = s => S(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, '&');
// UTF-8 decode with a built-in decoder (Airtable's TextDecoder can't be trusted with byte slices)
const utf8 = b => {
  let out = '', ch = [];
  for (let i = 0; i < b.length;) {
    let c = b[i++];
    if (c >= 0xf0 && c < 0xf8) c = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) c = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) c = ((c & 31) << 6) | (b[i++] & 63);
    if (c > 0xffff) { c -= 0x10000; ch.push(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff)); } else ch.push(c);
    if (ch.length >= 8192) { out += String.fromCharCode.apply(null, ch); ch = []; }
  }
  return out + String.fromCharCode.apply(null, ch);
};
const latin1 = b => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; };

// ---------- pure-JS raw DEFLATE decoder (no DecompressionStream needed; based on tinf by J. Ibsen) ----------
const INF = (() => {
  function Tree() { this.table = new Uint16Array(16); this.trans = new Uint16Array(288); }
  const sltree = new Tree(), sdtree = new Tree();
  const lbits = new Uint8Array(30), lbase = new Uint16Array(30), dbits = new Uint8Array(30), dbase = new Uint16Array(30);
  const clcidx = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  const code_tree = new Tree(), lengths = new Uint8Array(288 + 32), offs = new Uint16Array(16);
  function bitsBase(bits, base, delta, first) {
    for (let i = 0; i < delta; i++) bits[i] = 0;
    for (let i = 0; i < 30 - delta; i++) bits[i + delta] = (i / delta) | 0;
    for (let sum = first, i = 0; i < 30; i++) { base[i] = sum; sum += 1 << bits[i]; }
  }
  bitsBase(lbits, lbase, 4, 3); bitsBase(dbits, dbase, 2, 1);
  lbits[28] = 0; lbase[28] = 258;
  function buildTree(t, lens, off, num) {
    for (let i = 0; i < 16; i++) t.table[i] = 0;
    for (let i = 0; i < num; i++) t.table[lens[off + i]]++;
    t.table[0] = 0;
    for (let sum = 0, i = 0; i < 16; i++) { offs[i] = sum; sum += t.table[i]; }
    for (let i = 0; i < num; i++) if (lens[off + i]) t.trans[offs[lens[off + i]]++] = i;
  }
  (function fixed() {
    for (let i = 0; i < 7; i++) sltree.table[i] = 0;
    sltree.table[7] = 24; sltree.table[8] = 152; sltree.table[9] = 112;
    for (let i = 0; i < 24; i++) sltree.trans[i] = 256 + i;
    for (let i = 0; i < 144; i++) sltree.trans[24 + i] = i;
    for (let i = 0; i < 8; i++) sltree.trans[24 + 144 + i] = 280 + i;
    for (let i = 0; i < 112; i++) sltree.trans[24 + 144 + 8 + i] = 144 + i;
    for (let i = 0; i < 5; i++) sdtree.table[i] = 0;
    sdtree.table[5] = 32;
    for (let i = 0; i < 32; i++) sdtree.trans[i] = i;
  })();
  return function inflateRaw(src, sizeHint) {
    let pos = 0, tag = 0, bitcount = 0;
    let out = new Uint8Array(Math.max(sizeHint || 0, src.length * 4, 1024)), olen = 0;
    const ensure = n => { if (olen + n > out.length) { const nb = new Uint8Array(Math.max(out.length * 2, olen + n)); nb.set(out.subarray(0, olen)); out = nb; } };
    const getbit = () => { if (!bitcount--) { tag = pos < src.length ? src[pos++] : 0; bitcount = 7; } const b = tag & 1; tag >>>= 1; return b; };
    const readbits = (num, base) => { if (!num) return base; while (bitcount < 24) { tag |= (pos < src.length ? src[pos++] : 0) << bitcount; bitcount += 8; } const v = tag & (0xffff >>> (16 - num)); tag >>>= num; bitcount -= num; return v + base; };
    const decodeSym = t => {
      while (bitcount < 24) { tag |= (pos < src.length ? src[pos++] : 0) << bitcount; bitcount += 8; }
      let sum = 0, cur = 0, len = 0;
      do { cur = 2 * cur + (tag & 1); tag >>>= 1; ++len; sum += t.table[len]; cur -= t.table[len]; } while (cur >= 0);
      bitcount -= len; return t.trans[sum + cur];
    };
    const ltree = new Tree(), dtree = new Tree();
    const dynTrees = () => {
      const hlit = readbits(5, 257), hdist = readbits(5, 1), hclen = readbits(4, 4);
      for (let i = 0; i < 19; i++) lengths[i] = 0;
      for (let i = 0; i < hclen; i++) lengths[clcidx[i]] = readbits(3, 0);
      buildTree(code_tree, lengths, 0, 19);
      for (let num = 0; num < hlit + hdist;) {
        const sym = decodeSym(code_tree);
        if (sym === 16) { const prev = lengths[num - 1]; for (let l = readbits(2, 3); l; --l) lengths[num++] = prev; }
        else if (sym === 17) { for (let l = readbits(3, 3); l; --l) lengths[num++] = 0; }
        else if (sym === 18) { for (let l = readbits(7, 11); l; --l) lengths[num++] = 0; }
        else lengths[num++] = sym;
      }
      buildTree(ltree, lengths, 0, hlit); buildTree(dtree, lengths, hlit, hdist);
    };
    const block = (lt, dt) => {
      for (;;) {
        let sym = decodeSym(lt);
        if (sym === 256) return;
        if (sym < 256) { ensure(1); out[olen++] = sym; }
        else {
          sym -= 257;
          const length = readbits(lbits[sym], lbase[sym]), dist = decodeSym(dt), offs_ = olen - readbits(dbits[dist], dbase[dist]);
          if (offs_ < 0) throw new Error('bad zip data');
          ensure(length);
          for (let i = offs_; i < offs_ + length; ++i) out[olen++] = out[i];
        }
      }
    };
    let bfinal;
    do {
      bfinal = getbit();
      const btype = readbits(2, 0);
      if (btype === 0) {
        while (bitcount >= 8) { pos--; bitcount -= 8; } // give back bytes read ahead
        bitcount = 0; tag = 0; // align to byte
        const len = src[pos] | (src[pos + 1] << 8); pos += 4;
        ensure(len); out.set(src.subarray(pos, pos + len), olen); olen += len; pos += len;
      } else if (btype === 1) block(sltree, sdtree);
      else if (btype === 2) { dynTrees(); block(ltree, dtree); }
      else throw new Error('bad zip data');
      if (pos > src.length + 4) throw new Error('zip data ended early');
    } while (!bfinal);
    return out.subarray(0, olen);
  };
})();

// unzip helper: pure-JS decoder first (works in every Airtable runtime), the built-in DecompressionStream only as a fallback
async function inflate(bytes, fmt, sizeHint) {
  try { return INF(fmt === 'deflate' ? bytes.subarray(2) : bytes, sizeHint); }
  catch (e) {
    if (typeof DecompressionStream === 'undefined') throw e;
    const ds = new DecompressionStream(fmt);
    const w = ds.writable.getWriter(); w.write(bytes.slice()).catch(() => {}); w.close().catch(() => {});
    const chunks = []; const rd = ds.readable.getReader(); let total = 0;
    try { for (;;) { const {done, value} = await rd.read(); if (done) break; chunks.push(value); total += value.length; } } catch (e2) { if (!total) throw e; }
    const out = new Uint8Array(total); let o = 0; for (const ch of chunks) { out.set(ch, o); o += ch.length; } return out;
  }
}

// ---------- ZIP (xlsx / docx) ----------
async function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a valid zip file');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let k = 0; k < count && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loff = dv.getUint32(p + 42, true);
    const name = utf8(buf.subarray(p + 46, p + 46 + nlen));
    files[name] = {method, csize, usize, loff};
    p += 46 + nlen + elen + clen;
  }
  return {
    names: Object.keys(files),
    async read(name) {
      const f = files[name]; if (!f) return null;
      const n = dv.getUint16(f.loff + 26, true), e = dv.getUint16(f.loff + 28, true);
      const data = buf.subarray(f.loff + 30 + n + e, f.loff + 30 + n + e + f.csize);
      const raw = f.method === 0 ? data : await inflate(data, 'deflate-raw', f.usize);
      if (f.usize && !raw.length) throw new Error('could not unzip ' + name);
      return utf8(raw);
    }
  };
}
const colIdx = ref => { const m = S(ref).match(/^([A-Z]+)/); if (!m) return 0; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
// Reads every VISIBLE sheet. If the client filtered a sheet (Excel filter / hidden rows), only the rows they left
// visible are used, and the filter is described so the AI and the PM know which rows were taken.
async function readXlsx(buf, notes, fname) {
  const z = await unzip(buf);
  const ss = [];
  const sst = await z.read('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) ss.push(xmlText((m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '').match(/<(?:\w+:)?t[ >][\s\S]*?<\/(?:\w+:)?t>|<(?:\w+:)?t>[\s\S]*?<\/(?:\w+:)?t>/g) || []).join('')));
  // sheet names in workbook order (hidden sheets skipped)
  const wb = (await z.read('xl/workbook.xml')) || '', rels = (await z.read('xl/_rels/workbook.xml.rels')) || '';
  const relMap = {}; for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = (m[0].match(/\sId="([^"]+)"/) || [])[1], tg = (m[0].match(/\sTarget="([^"]+)"/) || [])[1]; if (id && tg) relMap[id] = tg; }
  let sheets = [...wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)].map(m => {
    const t = m[0], name = xmlText((t.match(/\sname="([^"]*)"/) || [])[1]), rid = (t.match(/\sr:id="([^"]+)"/) || [])[1], hidden = /\sstate="(hidden|veryHidden)"/.test(t);
    const tg = S(relMap[rid]); return {name, hidden, path: tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, '')};
  });
  if (!sheets.length) sheets = z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).map(n => ({name: n.split('/').pop(), path: n}));
  const out = [];
  for (const sh of sheets.slice(0, 10)) {
    if (sh.hidden) { notes.push(fname + ': hidden sheet "' + sh.name + '" skipped'); continue; }
    const x = await z.read(sh.path); if (!x) continue;
    const grid = [], hiddenRows = [];
    let total = 0;
    for (const rm of x.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
      const rattrs = rm[1], body = rm[2] || '';
      const rnum = +((rattrs.match(/\sr="(\d+)"/) || [])[1] || grid.length + hiddenRows.length + 1);
      const cells = [];
      for (const cm of body.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const attrs = cm[1], inner = cm[2] || '';
        const ref = (attrs.match(/\sr="([A-Z]+\d+)"/) || [])[1], t = (attrs.match(/\st="([^"]+)"/) || [])[1];
        let v = (inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1];
        if (t === 's') v = ss[+v]; else if (t === 'inlineStr') v = xmlText((inner.match(/<(?:\w+:)?t\b[^>]*>[\s\S]*?<\/(?:\w+:)?t>/g) || []).join('')); else v = xmlText(v);
        if (/^-?\d+\.\d{6,}$/.test(S(v))) v = String(Math.round(+v * 10000) / 10000); // 0.57101214574898784 -> 0.571
        if (S(v) !== '') cells[ref ? colIdx(ref) : cells.length] = S(v).replace(/\s+/g, ' ');
      }
      if (!cells.some(c => S(c))) continue;
      total++;
      if (/\shidden="(1|true)"/.test(rattrs)) { hiddenRows.push(rnum); continue; }
      grid.push(cells);
      if (grid.length >= 1500) break;
    }
    if (!grid.length) continue;
    // the client's Excel filter (which values they kept), described with the header names
    let filterNote = '';
    const af = x.match(/<(?:\w+:)?autoFilter\b[^>]*\sref="([A-Z]+)(\d+):[A-Z]+\d+"[^>]*>([\s\S]*?)<\/(?:\w+:)?autoFilter>/);
    const header = grid[0] || [];
    if (af) {
      const base = colIdx(af[1]);
      const parts = [...af[3].matchAll(/<(?:\w+:)?filterColumn\b[^>]*colId="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?filterColumn>/g)].map(f => {
        const col = base + +f[1], vals = [...f[2].matchAll(/<(?:\w+:)?filter\b[^>]*\sval="([^"]*)"/g)].map(v => xmlText(v[1]));
        const hdrName = S(header[col]) || ('column ' + (col + 1));
        return hdrName + (vals.length ? ' = ' + vals.join(' or ') : ' (custom filter)');
      });
      if (parts.length) filterNote = parts.join('; ');
    }
    // drop columns that are empty in every kept row (keeps the text short)
    const width = Math.max(...grid.map(r => r.length));
    const keep = []; for (let ci = 0; ci < width; ci++) if (grid.slice(1).some(r => S(r[ci]))) keep.push(ci);
    let rows = grid.map(r => keep.map(ci => r[ci] || '').join(' | ').replace(/(\s\|\s)+$/, ''));
    let head = '--- sheet: ' + sh.name + ' (' + (grid.length - 1) + ' data rows';
    if (hiddenRows.length) {
      head += '; ONLY THE ROWS THE CLIENT LEFT VISIBLE - ' + hiddenRows.length + ' rows were hidden/filtered out' + (filterNote ? ' by their Excel filter: ' + filterNote : '') + ' - use only these rows';
      notes.push(fname + ' / ' + sh.name + ': used the ' + (grid.length - 1) + ' rows visible after the client\'s filter' + (filterNote ? ' (' + filterNote + ')' : '') + ', ' + hiddenRows.length + ' hidden rows ignored');
    }
    // 🏬 Nov 13 (AGC 19145 CHANEL x SDM: 239 print rows for 44 stores = 82,000 characters, the text was cut at 45,000 and the last 22 stores were lost):
    // a sheet with a STORE column and several rows per store is sent ONE LINE PER STORE (the store's own values once, then one short item per
    // print row); columns that are the same on every row are said once. The store list itself also goes to the build step, which adds any store
    // the AI missed, so a long sheet can never drop stores again.
    const hdrN = ci => S(header[ci]).replace(/\s+/g, ' ');
    const data = grid.slice(1);
    const storeCol = (() => { let best = -1, bs = 0;
      for (const ci of keep) { const h = hdrN(ci); if (!/shop|store|location|door|site|branch|outlet|venue/i.test(h) || /priority|channel|type|segment|position|count|qty|#\s*of/i.test(h)) continue;
        const vals = data.map(r => S(r[ci])).filter(Boolean); if (vals.length < Math.max(2, data.length * 0.6)) continue;
        const withNum = vals.filter(v => /\d{2,6}/.test(v)).length / vals.length, uniq = new Set(vals).size;
        const sc = withNum * 2 + (/name/i.test(h) ? 0.2 : 0) + (/number|#/i.test(h) ? 0.1 : 0) + (uniq > 1 ? 1 : 0);
        if (sc > bs) { bs = sc; best = ci; } }
      return best; })();
    const colOf = re => keep.find(ci => ci !== storeCol && re.test(hdrN(ci)));
    const brandCol = colOf(/retailer|brand|banner|chain/i), cityCol = colOf(/^\s*city|town|municipal/i), addrCol = colOf(/address|street/i), provCol = colOf(/prov|state/i);
    if (storeCol >= 0) {
      const order = [], by = new Map();
      for (const r of data) { const k = S(r[storeCol]); if (!k) continue; if (!by.has(k)) { by.set(k, []); order.push(k); } by.get(k).push(r); }
      for (const k of order) { const r0 = by.get(k)[0];
        SHEET_STORES.push({name: k, brand: brandCol != null ? S(r0[brandCol]) : '', city: cityCol != null ? S(r0[cityCol]) : '', address: [addrCol, cityCol, provCol].filter(x => x != null).map(x => S(r0[x])).filter(Boolean).join(', '), rows: by.get(k).length, file: fname, sheet: sh.name}); }
      if (data.length > order.length * 1.2 || rows.join('\n').length > 15000) {
        const same = (rs, ci) => rs.every(r => S(r[ci]) === S(rs[0][ci]));
        const globalCols = keep.filter(ci => ci !== storeCol && same(data, ci));
        const otherCols = keep.filter(ci => ci !== storeCol && !globalCols.includes(ci));
        // a very long sheet: the longest per-row columns (names, codes) are left out until it fits; sizes, quantities, materials, dates and priority stay
        const KEEP_RE = /size|qty|quant|material|date|time|axis|priority|width|height/i;
        let itemCols = otherCols.slice(); const dropped = [];
        const build = () => order.map(k => { const rs = by.get(k);
          const perStore = otherCols.filter(ci => same(rs, ci) && S(rs[0][ci])), items = itemCols.filter(ci => !perStore.includes(ci));
          let l = 'STORE: ' + k + (perStore.length ? ' | ' + perStore.map(ci => hdrN(ci) + ': ' + S(rs[0][ci])).join(' | ') : '');
          if (rs.length > 1 && items.length) l += ' | ' + rs.length + ' rows (' + items.map(hdrN).join(' · ') + '): ' + rs.map((r, i) => '[' + (i + 1) + '] ' + items.map(ci => S(r[ci]) || '-').join(' · ')).join(' ');
          else if (rs.length > 1) l += ' | ' + rs.length + ' rows';
          return l; });
        let lines = build();
        while (lines.join('\n').length > 36000 && itemCols.length) {
          const cand = itemCols.filter(ci => !KEEP_RE.test(hdrN(ci))); const pool = cand.length ? cand : itemCols;
          const big = pool.map(ci => ({ci, n: data.reduce((a, r) => a + S(r[ci]).length, 0)})).sort((a, b) => b.n - a.n)[0];
          itemCols = itemCols.filter(ci => ci !== big.ci); dropped.push(hdrN(big.ci)); lines = build();
        }
        head += '; GROUPED ONE LINE PER STORE: ' + order.length + ' stores (column \'' + hdrN(storeCol) + '\')' +
          (globalCols.length ? '; SAME ON EVERY ROW: ' + globalCols.map(ci => hdrN(ci) + ' = ' + S(data[0][ci])).join('; ') : '') +
          (dropped.length ? '; left out to keep it short (per-row): ' + dropped.join(', ') : '');
        rows = lines;
        notes.push(fname + ' / ' + sh.name + ': ' + data.length + ' rows grouped into ' + order.length + ' stores');
      }
    }
    out.push(head + ') ---\n' + rows.join('\n'));

  }
  return out.join('\n');
}

window.__test = async (url) => { const r = await fetch(url); const buf = new Uint8Array(await r.arrayBuffer()); const notes = []; SHEET_STORES.length = 0; const txt = await readXlsx(buf, notes, 'order.xlsx'); return {len: txt.length, notes, stores: SHEET_STORES.length, txt, ss: SHEET_STORES}; };
