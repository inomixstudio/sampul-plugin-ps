/* Sampul — salin master ke folder plugin UXP.

   node scripts/sync.js [destinasi]

   Tanpa argumen: %APPDATA%\Adobe\UXP\Plugins\External\com.99desains.sampul
   (Photoshop membaca folder ini saat Developer Mode aktif; restart Photoshop
   supaya salinan baru dipakai.)
*/
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const DEST = process.argv[2] || path.join(
  process.env.APPDATA || path.join(process.env.HOME || "", "AppData", "Roaming"),
  "Adobe", "UXP", "Plugins", "External", manifest.id
);

const FILES = ["manifest.json", "index.html", "main.js", "styles.css", "README.md"];
const DIRS = ["icons"];

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyTree(a, b);
    else { fs.copyFileSync(a, b); n++; }
  }
  return n;
}

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

let count = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.error("  hilang: " + f); continue; }
  fs.copyFileSync(src, path.join(DEST, f));
  count++;
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) count += copyTree(src, path.join(DEST, d));
}

/* Buang sisa file versi lama yang tidak lagi bagian dari plugin. */
const keep = new Set(FILES.concat(DIRS));
for (const entry of fs.readdirSync(DEST)) {
  if (!keep.has(entry) && entry !== ".git") {
    const p = path.join(DEST, entry);
    fs.rmSync(p, { recursive: true, force: true });
    console.log("  dibersihkan: " + entry);
  }
}

console.log("v" + manifest.version + " -> " + DEST + "  (" + count + " file)");
console.log("Restart Photoshop (atau Load ulang di UXP Developer Tool) supaya salinan baru dipakai.");
