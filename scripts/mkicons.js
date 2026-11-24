// Pembuat ikon PNG minimal (RGBA 8-bit) tanpa dependensi — untuk icons/ plugin Sampul.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crcTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const T = crcTable();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ T[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Sampul buku: kotak pepojok bulat + jalur punggung + bidang judul.
function draw(size, pal) {
  const px = Buffer.alloc(size * size * 4);
  const r = size * 0.16;                       // radius pojok
  const pad = Math.max(1, Math.round(size * 0.08));
  const x0 = pad, y0 = pad, x1 = size - pad, y1 = size - pad;
  function insideRound(x, y) {
    if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
    let cx = null, cy = null;
    if (x < x0 + r) cx = x0 + r; else if (x > x1 - r) cx = x1 - r;
    if (y < y0 + r) cy = y0 + r; else if (y > y1 - r) cy = y1 - r;
    if (cx === null || cy === null) return true;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }
  const spineW = Math.max(1, Math.round(size * 0.16));
  const barY0 = Math.round(y0 + (y1 - y0) * 0.34), barY1 = Math.round(y0 + (y1 - y0) * 0.46);
  const barX0 = Math.round(x0 + (x1 - x0) * 0.42), barX1 = Math.round(x1 - (x1 - x0) * 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let col = null;
      if (insideRound(x, y)) {
        if (x < x0 + spineW) col = pal.accent;
        else if (y >= barY0 && y < barY1 && x >= barX0 && x < barX1) col = pal.accent;
        else col = pal.face;
      } else if (insideRound(x + 1, y) || insideRound(x - 1, y) || insideRound(x, y + 1) || insideRound(x, y - 1)) {
        col = pal.edge;
      }
      const i = (y * size + x) * 4;
      if (col) { px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255; }
      else { px[i + 3] = 0; }
    }
  }
  return px;
}

const outDir = process.argv[2] || path.join(__dirname, "..", "icons");
const sets = {
  // icon_D = untuk UI gelap, icon_N = untuk UI terang
  icon_D: { face: [46, 52, 63], accent: [233, 180, 76], edge: [233, 180, 76] },
  icon_N: { face: [242, 235, 221], accent: [166, 57, 46], edge: [90, 78, 66] }
};
fs.mkdirSync(outDir, { recursive: true });
for (const [base, pal] of Object.entries(sets)) {
  for (const [scale, size] of [[1, 20], [2, 40]]) {
    const buf = png(size, size, draw(size, pal));
    /* UXP mencari "icon_D.png" DAN "icon_D@1x.png"; kalau @1x tidak ada ia
       mencatat "Scaled Icon ... not found" di log UXP Photoshop. */
    const names = scale === 1 ? [base + ".png", base + "@1x.png"] : [base + "@2x.png"];
    for (const name of names) {
      const file = path.join(outDir, name);
      fs.writeFileSync(file, buf);
      console.log(file, buf.length + " B", size + "x" + size);
    }
  }
}
