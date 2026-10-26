/* Generador de códigos QR sin dependencias (modo byte, versiones 1-10, corrección L/M/Q/H).
   Sigue el estándar ISO/IEC 18004. Uso:
     const qr = QR.encode('texto', 'Q');   // { size, modules[y][x], version, mask }
     QR.toSvg(qr, { border: 4 });          // string <svg>
     QR.toCanvas(qr, canvas, 8, 4);        // dibuja en un <canvas>                       */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QR = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_VERSION = 10;
  // Índice = versión (la posición 0 no se usa).
  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
  };
  const NUM_BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
  };
  const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  const getBit = (x, i) => ((x >>> i) & 1) !== 0;

  function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(ver, ecc) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver] * NUM_BLOCKS[ecc][ver];
  }

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  // ---- Reed-Solomon sobre GF(256) ----
  function rsMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => { result[i] ^= rsMultiply(coef, factor); });
    }
    return result;
  }

  function addEccAndInterleave(data, ver, ecc) {
    const numBlocks = NUM_BLOCKS[ecc][ver];
    const blockEccLen = ECC_PER_BLOCK[ecc][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(blockEccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const e = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(e));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  // ---- Penalización para elegir la máscara ----
  function penalty(modules, size) {
    let score = 0;
    const lines = [];
    for (let y = 0; y < size; y++) lines.push(modules[y].map((b) => (b ? '1' : '0')).join(''));
    for (let x = 0; x < size; x++) {
      let s = '';
      for (let y = 0; y < size; y++) s += modules[y][x] ? '1' : '0';
      lines.push(s);
    }
    for (const s of lines) {
      for (const run of s.match(/0+|1+/g)) if (run.length >= 5) score += run.length - 2;
      for (const pat of ['10111010000', '00001011101']) {
        let i = -1;
        while ((i = s.indexOf(pat, i + 1)) !== -1) score += 40;
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark++;
        if (y < size - 1 && x < size - 1) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
        }
      }
    }
    const total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }

  function encode(text, eccLevel) {
    const ecc = eccLevel || 'M';
    if (!ECC_PER_BLOCK[ecc]) throw new RangeError('Nivel de corrección inválido: ' + ecc);
    const bytes = Array.from(new TextEncoder().encode(String(text)));

    let ver = 1;
    let dataCap = 0;
    for (; ; ver++) {
      if (ver > MAX_VERSION) throw new RangeError('Texto demasiado largo para este generador');
      dataCap = numDataCodewords(ver, ecc) * 8;
      if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCap) break;
    }

    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(0x4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => push(b, 8));
    push(0, Math.min(4, dataCap - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < dataCap; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }
    const codewords = addEccAndInterleave(data, ver, ecc);

    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { modules[y][x] = dark; isFn[y][x] = true; };

    // Patrones de función
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
        }
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = alignmentPositions(ver);
    const n = align.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) setFn(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    const drawFormat = (mask) => {
      const d = (FORMAT_BITS[ecc] << 3) | mask;
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const f = ((d << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFn(8, i, getBit(f, i));
      setFn(8, 7, getBit(f, 6));
      setFn(8, 8, getBit(f, 7));
      setFn(7, 8, getBit(f, 8));
      for (let i = 9; i < 15; i++) setFn(14 - i, 8, getBit(f, i));
      for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(f, i));
      for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(f, i));
      setFn(8, size - 8, true);
    };
    drawFormat(0);

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const v = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = getBit(v, i);
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        setFn(a, b, dark); setFn(b, a, dark);
      }
    }

    // Datos en zigzag
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFn[y][x] && k < codewords.length * 8) {
            modules[y][x] = getBit(codewords[k >>> 3], 7 - (k & 7));
            k++;
          }
        }
      }
    }

    const applyMask = (mask) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (isFn[y][x]) continue;
          let invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    };

    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const p = penalty(modules, size);
      if (p < bestScore) { bestScore = p; best = m; }
      applyMask(m);
    }
    applyMask(best);
    drawFormat(best);
    return { size, modules, version: ver, mask: best };
  }

  function toSvg(qr, opts) {
    const o = Object.assign({ border: 4, dark: '#000', light: '#fff' }, opts);
    const dim = qr.size + o.border * 2;
    let d = '';
    for (let y = 0; y < qr.size; y++) {
      let x = 0;
      while (x < qr.size) {
        if (!qr.modules[y][x]) { x++; continue; }
        let run = 1;
        while (x + run < qr.size && qr.modules[y][x + run]) run++;
        d += 'M' + (x + o.border) + ',' + (y + o.border) + 'h' + run + 'v1h-' + run + 'z';
        x += run;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + o.light + '"/><path d="' + d + '" fill="' + o.dark + '"/></svg>';
  }

  function toCanvas(qr, canvas, scale, border) {
    const s = scale || 8, b = border === undefined ? 4 : border;
    const dim = (qr.size + b * 2) * s;
    canvas.width = dim; canvas.height = dim;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000';
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) ctx.fillRect((x + b) * s, (y + b) * s, s, s);
    }
    return canvas;
  }

  return { encode, toSvg, toCanvas };
});
