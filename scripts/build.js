#!/usr/bin/env node
/*
 * Membuat paket distribusi .ccx (ZIP) tanpa dependensi.
 *
 *   npm run build
 *
 * Hasil: dist/<id>_PS.ccx
 * Isi: manifest.json (entri pertama), index.html, main.js, styles.css, icons/*.png
 * Tidak memakai npm pack karena npm selalu menyertakan package.json/README.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");

function fail(message) {
  console.error("build: " + message);
  process.exit(1);
}

function readManifest() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch (err) {
    fail("manifest.json tidak bisa dibaca: " + err.message);
  }
  if (!manifest.id || typeof manifest.id !== "string") fail("manifest.id kosong");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.id)) fail("manifest.id tidak valid: " + manifest.id);
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || ""))) fail("manifest.version harus x.y.z");
  const host = manifest.host;
  if (!host || Array.isArray(host) || host.app !== "PS") fail("manifest.host harus objek dengan app \"PS\"");
  if (!manifest.icons || !Array.isArray(manifest.icons) || manifest.icons.length === 0) fail("manifest.icons kosong");
  return manifest;
}

function collectFiles(manifest) {
  const files = ["manifest.json", "index.html", "main.js", "styles.css"];
  for (const file of files) {
    if (!fs.existsSync(path.join(ROOT, file))) fail("berkas wajib tidak ada: " + file);
  }
  const iconDir = path.join(ROOT, "icons");
  const icons = fs.readdirSync(iconDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort();
  if (icons.length === 0) fail("folder icons/ tidak berisi PNG");
  for (const icon of icons) files.push("icons/" + icon);

  // Semua ikon yang dirujuk manifest harus ikut terpaket.
  for (const icon of manifest.icons) {
    const rel = String(icon.path || "").replace(/^\.\//, "").replace(/\\/g, "/");
    if (rel && !files.includes(rel)) files.push(rel);
  }
  for (const rel of files) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail("ikon yang dirujuk manifest tidak ada: " + rel);
  }
  return files;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime(fs.statSync(MANIFEST_PATH).mtime);

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const deflated = zlib.deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0014, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + deflated.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function main() {
  const manifest = readManifest();
  const files = collectFiles(manifest);
  const entries = files.map((name) => ({
    name,
    data: fs.readFileSync(path.join(ROOT, name)),
  }));

  fs.mkdirSync(DIST, { recursive: true });
  const outPath = path.join(DIST, manifest.id + "_PS.ccx");
  const zip = makeZip(entries);
  fs.writeFileSync(outPath, zip);

  const rel = path.relative(ROOT, outPath).replace(/\\/g, "/");
  console.log("build: " + rel + " (" + zip.length + " byte, " + entries.length + " entri)");
  console.log("build: " + manifest.name + " v" + manifest.version + " -> PS >= " + manifest.host.minVersion);
}

main();
