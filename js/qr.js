/* Minimal QR Code encoder (byte mode, error-correction level M, versions 1–10).
 * Written for MMI Practice Circuit so the app loads no third-party code.
 * Browser: window.MMIQR.toSVG(text). Node: require('./qr.js').encode(text).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMIQR = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // GF(256), primitive polynomial 0x11D
  const EXP = new Array(512), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function rsGenerator(deg) {
    let g = [1];
    for (let i = 0; i < deg; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  }
  function rsRemainder(data, deg) {
    const g = rsGenerator(deg);
    const res = new Array(deg).fill(0);
    for (const b of data) {
      const f = b ^ res.shift();
      res.push(0);
      for (let j = 0; j < deg; j++) res[j] ^= mul(g[j + 1], f);
    }
    return res;
  }

  // Level M: [ecc codewords per block, [[blocks, data codewords per block], ...]]
  const TABLE_M = {
    1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
    6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]]
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  const FORMAT_M = 0; // ECC level M format bits

  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(text));
    return unescape(encodeURIComponent(text)).split("").map((c) => c.charCodeAt(0));
  }
  const dataCapacity = (v) => TABLE_M[v][1].reduce((s, [n, d]) => s + n * d, 0);

  function encode(text) {
    const bytes = utf8(String(text));
    let version = 0;
    for (let v = 1; v <= 10; v++) {
      const cc = v < 10 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= dataCapacity(v) * 8) { version = v; break; }
    }
    if (!version) throw new Error("Text too long for QR version 10-M");
    const capBits = dataCapacity(version) * 8;

    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    for (let pad = 0xec; data.length < capBits / 8; pad ^= 0xec ^ 0x11) data.push(pad);

    // Split into blocks, add error correction, interleave
    const [eccLen, groups] = TABLE_M[version];
    const blocks = [];
    let k = 0;
    groups.forEach(([n, d]) => { for (let i = 0; i < n; i++) { const blk = data.slice(k, k + d); k += d; blocks.push({ d: blk, e: rsRemainder(blk, eccLen) }); } });
    const out = [];
    const maxD = Math.max(...blocks.map((b) => b.d.length));
    for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < eccLen; i++) blocks.forEach((b) => out.push(b.e[i]));

    const size = version * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[version], last = al.length - 1;
    al.forEach((ay, i) => al.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = (mask) => {
      const d = (FORMAT_M << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      const bit = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0); // reserve
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3);
        set(a, c, dark); set(c, a, dark);
      }
    }

    // Place data bits in the zigzag
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < out.length * 8) {
            mod[y][x] = ((out[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
            bi++;
          }
        }
      }
    }

    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    ];
    const applyMask = (m) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };
    const penalty = () => {
      let p = 0;
      const lines = [];
      for (let i = 0; i < size; i++) { lines.push(mod[i].slice()); lines.push(mod.map((r) => r[i])); }
      const F1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0].join(""), F2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1].join("");
      lines.forEach((ln) => {
        let run = 1;
        for (let i = 1; i <= ln.length; i++) {
          if (i < ln.length && ln[i] === ln[i - 1]) run++;
          else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
        const s = ln.map((b) => (b ? 1 : 0)).join("");
        for (let i = s.indexOf(F1); i >= 0; i = s.indexOf(F1, i + 1)) p += 40;
        for (let i = s.indexOf(F2); i >= 0; i = s.indexOf(F2, i + 1)) p += 40;
      });
      let dark = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (mod[y][x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = mod[y][x];
          if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
        }
      }
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      const p = penalty();
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { version, size, modules: mod, mask: best };
  }

  function toSVG(text, opts) {
    const o = Object.assign({ margin: 4, dark: "#000", light: "#fff", title: "" }, opts || {});
    const q = encode(text);
    const n = q.size + o.margin * 2;
    let d = "";
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += "M" + (x + o.margin) + " " + (y + o.margin) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" role="img"' +
      (o.title ? ' aria-label="' + String(o.title).replace(/"/g, "&quot;") + '"' : "") + ">" +
      '<rect width="' + n + '" height="' + n + '" fill="' + o.light + '"/><path d="' + d + '" fill="' + o.dark + '"/></svg>';
  }

  return { encode, toSVG };
});
