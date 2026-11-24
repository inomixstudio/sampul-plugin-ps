/* Sampul — uji mandiri (tanpa Photoshop)
   Menjalankan main.js di dalam DOM tiruan, lalu memeriksa matematika warna,
   integritas data, penyimpanan, dan deskriptor batchPlay.

     node scripts/selftest.js
*/
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SRC_PATH = path.join(ROOT, "main.js");
const src = fs.readFileSync(SRC_PATH, "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

let ok = 0, bad = 0;
const fails = [];
function t(name, cond, extra) {
  if (cond) { ok++; console.log("  ok   " + name + (extra ? "  " + extra : "")); }
  else { bad++; fails.push(name + (extra ? " — " + extra : "")); console.log("  GAGAL " + name + (extra ? "  " + extra : "")); }
}
function section(s) { console.log("\n" + s); }

/* ---------------- DOM tiruan ---------------- */

const els = {};
function fakeEl(id) {
  const el = {
    id: id,
    innerHTML: "",
    textContent: "",
    value: "",
    className: "",
    checked: false,
    attrs: {},
    style: {},
    listeners: {},
    classList: {
      _s: {},
      add: function (c) { this._s[c] = 1; },
      remove: function (c) { delete this._s[c]; },
      toggle: function (c, on) { if (on === undefined || on) this._s[c] = 1; else delete this._s[c]; },
      contains: function (c) { return !!this._s[c]; }
    },
    getAttribute: function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); },
    getBoundingClientRect: function () { return { width: 340, height: 500, top: 0, left: 0 }; },
    appendChild: function () {}, removeChild: function () {}, focus: function () {},
    select: function () {}, setSelectionRange: function () {}
  };
  return el;
}
function byId(id) { if (!els[id]) els[id] = fakeEl(id); return els[id]; }

const documentStub = {
  readyState: "complete",
  body: fakeEl("body"),
  getElementById: function (id) { return byId("#" + id); },
  querySelector: function (sel) { return byId(sel); },
  querySelectorAll: function () { return []; },
  createElement: function () { return fakeEl("created"); },
  addEventListener: function () {}
};

const store = {};
const ctx = vm.createContext({
  console: console,
  document: documentStub,
  window: { addEventListener: function () {} },
  navigator: {},
  localStorage: {
    getItem: function (k) { return store[k] === undefined ? null : store[k]; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
});

try {
  vm.runInContext(src, ctx);
  t("main.js berjalan tanpa melempar (mode demo)", true);
} catch (e) {
  t("main.js berjalan tanpa melempar (mode demo)", false, String(e && e.stack || e).split("\n")[0]);
  console.log("\nBERHENTI: panel tidak bisa dimuat.");
  process.exit(1);
}

const g = ctx;
/* const/let di puncak skrip tidak jadi properti globalThis — ekspor sekali. */
vm.runInContext("globalThis.T = { PALETTES: PALETTES, PAIRINGS: PAIRINGS, GENRES: GENRES, FEELS: FEELS, " +
  "SCHEMES: SCHEMES, PRESETS: PRESETS, PAPERS: PAPERS, WRAP_FORMATS: WRAP_FORMATS, BLEEDS: BLEEDS, " +
  "MAX_CUSTOM: MAX_CUSTOM, PICK_LIMIT: PICK_LIMIT, state: state, wrapGeom: wrapGeom, wrapGuideLines: wrapGuideLines, " +
  "paletteFromSamples: paletteFromSamples, serializeProject: serializeProject, applyProject: applyProject };", ctx);
g.t_ = g.T;
const PALETTES = g.T.PALETTES, PAIRINGS = g.T.PAIRINGS, state = g.T.state;
t("mode demo terdeteksi (tidak ada Photoshop)", g.PS.live === false);

/* ---------------- 1. matematika warna ---------------- */

section("== 1. Kontras WCAG ==");
t("#000 vs #fff = 21,00", Math.abs(g.contrastRatio("#000000", "#FFFFFF") - 21) < 0.01, "-> " + g.contrastRatio("#000000", "#FFFFFF").toFixed(2));
t("#767676 vs #fff ~ 4,54", Math.abs(g.contrastRatio("#767676", "#FFFFFF") - 4.54) < 0.02, "-> " + g.contrastRatio("#767676", "#FFFFFF").toFixed(2));
t("kontras simetris dan self = 1", Math.abs(g.contrastRatio("#123456", "#ABCDEF") - g.contrastRatio("#ABCDEF", "#123456")) < 1e-9 && Math.abs(g.contrastRatio("#808080", "#808080") - 1) < 1e-9);

section("== 2. OKLCH ==");
t("L=1,C=0 -> #FFFFFF", g.oklchToHex(1, 0, 0) === "#FFFFFF");
t("L=0 -> #000000", g.oklchToHex(0, 0, 137) === "#000000");
t("hue merah ~27,7", Math.abs(g.hexToOklch("#FF0000").H - 27.7) < 3, "-> " + g.hexToOklch("#FF0000").H.toFixed(1) + "\u00b0");
t("hue biru ~264", Math.abs(g.hexToOklch("#0000FF").H - 264.05) < 3, "-> " + g.hexToOklch("#0000FF").H.toFixed(1) + "\u00b0");
const o = g.hexToOklch("#A6392E");
t("roundtrip hex->oklch->hex stabil", g.oklchToHex(o.L, o.C, o.H) === "#A6392E", "-> " + g.oklchToHex(o.L, o.C, o.H));
let badClip = 0;
for (let h = 0; h < 360; h += 5) if (!/^#[0-9A-F]{6}$/.test(g.oklchToHex(0.9, 0.4, h))) badClip++;
t("chroma di luar gamut dipangkas rapi", badClip === 0, "-> cacat " + badClip);

/* ---------------- 2. data kurasi ---------------- */

section("== 3. Data kurasi ==");
t("28 palet + 19 pasangan", PALETTES.length === 28 && PAIRINGS.length === 19, "-> " + PALETTES.length + " / " + PAIRINGS.length);
const ids = new Set(); let dup = 0;
[].concat(PALETTES, PAIRINGS).forEach(function (p) { if (ids.has(p.id)) dup++; ids.add(p.id); });
t("id unik", dup === 0, "-> duplikat " + dup);
const genreIds = new Set(g.T.GENRES.map(function (x) { return x.id; }));
const feelIds = new Set(g.T.FEELS.map(function (x) { return x.id; }));
let refBad = 0, hexBad = 0, psBad = 0;
[].concat(PALETTES, PAIRINGS).forEach(function (p) {
  p.genres.forEach(function (x) { if (!genreIds.has(x)) refBad++; });
  p.feels.forEach(function (x) { if (!feelIds.has(x)) refBad++; });
});
PALETTES.forEach(function (p) { Object.keys(p.colors).forEach(function (k) { if (!/^#[0-9A-Fa-f]{6}$/.test(p.colors[k])) hexBad++; }); });
PAIRINGS.forEach(function (p) { if (!p.heading.boldPS.length || !p.body.regularPS.length) psBad++; });
t("rujukan genre/rasa valid", refBad === 0, "-> salah " + refBad);
t("semua HEX kurasi valid", hexBad === 0, "-> salah " + hexBad);
t("semua pairing punya nama PostScript", psBad === 0);
["elegan", "romantis", "tegas", "misterius", "hangat", "ceria", "minimal", "nostalgik", "dramatis", "futuristik"].forEach(function (f) {
  const np = PAIRINGS.filter(function (p) { return p.feels.indexOf(f) >= 0; }).length;
  const npal = PALETTES.filter(function (p) { return p.feels.indexOf(f) >= 0; }).length;
  t("rasa '" + f + "' punya palet + pairing", npal > 0 && np > 0, "-> " + npal + " palet / " + np + " pairing");
});
let lowInk = 0, lowAcc = 0;
PALETTES.forEach(function (p) {
  if (g.contrastRatio(p.colors.ink, p.colors.base) < 4.5) lowInk++;
  if (g.contrastRatio(p.colors.accent, p.colors.base) < 3) lowAcc++;
});
t("palet kurasi: tinta >= 4,5:1", lowInk === 0, "-> kurang " + lowInk);
t("palet kurasi: aksen >= 3:1", lowAcc === 0, "-> kurang " + lowAcc);

/* ---------------- 4. generator ---------------- */

section("== 4. Generator ==");
const tones = ["dark", "light"], schemes = Object.keys(g.T.SCHEMES);
let worstAcc = 99, worstInk = 99, worstMuted = 99, n = 0, shapeBad = 0;
for (let h = 0; h < 360; h += 3) {
  [0.02, 0.09, 0.15, 0.22].forEach(function (c) {
    const hx = g.oklchToHex(0.6, c, h);
    schemes.forEach(function (s) {
      tones.forEach(function (tn) {
        const p = g.generatePalette(hx, s, tn);
        n++;
        if (Object.keys(p.colors).length !== 5 || !Object.keys(p.colors).every(function (k) { return /^#[0-9A-F]{6}$/.test(p.colors[k]); })) shapeBad++;
        worstAcc = Math.min(worstAcc, g.contrastRatio(p.colors.accent, p.colors.base));
        worstInk = Math.min(worstInk, g.contrastRatio(p.colors.ink, p.colors.base));
        worstMuted = Math.min(worstMuted, g.contrastRatio(p.colors.muted, p.colors.base));
      });
    });
  });
}
console.log("  " + n + " kombinasi diuji");
t("bentuk palet selalu sah", shapeBad === 0, "-> cacat " + shapeBad);
t("aksen >= 4,5:1 (ambang judul baru)", worstAcc >= 4.5, "-> terburuk " + worstAcc.toFixed(2) + ":1");
t("tinta >= 4,5:1", worstInk >= 4.5, "-> terburuk " + worstInk.toFixed(2) + ":1");
t("redup >= 3:1", worstMuted >= 3, "-> terburuk " + worstMuted.toFixed(2) + ":1");

const grey = g.generatePalette("#808080", "mono", "dark");
function chroma(h) { return g.hexToOklch(h).C; }
const grey2 = g.generatePalette("#000000", "analogous", "light");
const grey3 = g.generatePalette("#ffffff", "complementary", "dark");
t("input netral -> dasar tetap netral (bukan hue noise)", chroma(grey.colors.base) < 0.02 && chroma(grey2.colors.base) < 0.02 && chroma(grey3.colors.base) < 0.02,
  "-> C " + chroma(grey.colors.base).toFixed(3) + " / " + chroma(grey2.colors.base).toFixed(3));
t("dua abu berbeda tidak menghasilkan hue karbitan", grey.name.indexOf("Zaitun") < 0 || chroma(grey.colors.base) < 0.02, "-> " + grey.name);

section("== 5. uniqueName ==");
let names = [];
for (let i = 0; i < 8; i++) names.push(g.uniqueName("Malam Emas", names.map(function (nm) { return { name: nm }; })));
t("nama kembar diberi penomoran", new Set(names).size === names.length, "-> " + names.slice(0, 3).join(", ") + " ...");

/* ---------------- 6. penyimpanan ---------------- */

section("== 6. Penyimpanan ==");
const polluted = [
  { id: "fix-1", name: "Hutan Kuno (kontras)", genres: ["fantasi"], feels: [], colors: PALETTES[9].colors, note: "x" },
  { id: "fix-2", name: "Tinta Malam (kontras)", genres: [], feels: [], colors: PALETTES[1].colors, note: "x" },
  { id: "gen-3", name: "Rusak", genres: [], feels: [], colors: { base: "#12", surface: "#345", accent: "red", ink: "#fff", muted: "#eee" } },
  { id: "gen-4", name: "Palet Saya", genres: ["sastra"], feels: ["elegan"], colors: { base: "#101A16", surface: "#1B2A22", accent: "#F0F0F0", ink: "#EEF3E6", muted: "#83998A" }, note: "x" }
];
const pruned = g.pruneCustom(polluted);
t("palet sama persis dengan palet kurasi dibuang", pruned.filter(function (p) { return p.id === "fix-1" || p.id === "fix-2"; }).length === 0, "-> sisa " + pruned.length);
t("palet cacat dibuang", pruned.filter(function (p) { return p.id === "gen-3"; }).length === 0);
t("palet sah dipertahankan", pruned.filter(function (p) { return p.id === "gen-4"; }).length === 1);
const many = [];
for (let i = 0; i < 40; i++) {
  many.push({ id: "x" + i, name: "P" + i, genres: [], feels: [], colors: { base: g.oklchToHex(0.2, 0.02, i * 9), surface: g.oklchToHex(0.3, 0.02, i * 9), accent: g.oklchToHex(0.8, 0.12, i * 9), ink: "#FFFFFF", muted: "#888888" }, note: "" });
}
t("jumlah palet simpanan dibatasi", g.pruneCustom(many).length === g.T.MAX_CUSTOM, "-> " + g.pruneCustom(many).length + " (maks " + g.T.MAX_CUSTOM + ")");
const sigSame = g.sigOf({ colors: { base: "#ffffff", surface: "#FFF", accent: "#000000", ink: "#000", muted: "#123456" } }) ===
  g.sigOf({ colors: { base: "#FFFFFF", surface: "#FFFFFF", accent: "#000000", ink: "#000000", muted: "#123456" } });
t("sigOf menormalkan HEX", sigSame);

/* ---------------- 7. render ---------------- */

section("== 7. Render ==");
state.cover.title = "A BRONX KID IN THE ROOM";
state.paletteId = null;
state.pairingId = "bebas-barlow";
const stageHtml = g.coverInnerHTML(30);
t("judul multi-baris -> <br /> asli, bukan teks literal", stageHtml.indexOf("<br />") >= 0 && stageHtml.indexOf("&lt;br") < 0);
t("tidak ada <select>/<option> di HTML yang dihasilkan", /<select|<option/.test(HTML + stageHtml + g.$("#presetChips").innerHTML + g.$("#overrideBox").innerHTML) === false);
g.renderPickers();
t("chip preset kanvas dirender", g.$("#presetChips").innerHTML.indexOf("pick-preset") >= 0, "-> " + g.$("#presetChips").innerHTML.length + " B");
t("chip harmoni + nada dirender", g.$("#schemeChips").innerHTML.indexOf("pick-scheme") >= 0 && g.$("#toneChips").innerHTML.indexOf("pick-tone") >= 0);
g.T.state.fonts = { ok: true, styleCount: 4200, famCount: 1200, byFamily: { inter: { family: "Inter", styles: [{ ps: "Inter-Regular", style: "Regular", weight: 400, italic: false }] } }, error: null, ms: 12, loaded: true };
g.T.state.fontPick = "heading";
g.PS.live = true;                 // renderFontPickers perlu PS "hidup"
g.renderFontPickers();
g.PS.live = false;
t("pemilih font memakai daftar terbatas", g.$("#overrideBox").innerHTML.indexOf("pick-opt") >= 0 &&
  (g.$("#overrideBox").innerHTML.match(/pick-opt/g) || []).length <= g.T.PICK_LIMIT + 2);
t("pemilih font punya kolom saring", g.$("#overrideBox").innerHTML.indexOf("pickQuery") >= 0);

section("== 8. Perilaku tombol ==");
function el(attrs) { const e = fakeEl("evt"); e.attrs = attrs || {}; return e; }
state.paletteId = null;
state.custom = [];
const rich = g.findById(PALETTES, "hutan-kuno");
state.paletteId = rich.id;
const nBefore = state.custom.length;
g.handleAction("fix-contrast", el({}));
t("'Perbaiki kontras' tidak lagi menumpuk palet kembar", state.custom.length === nBefore, "-> custom " + state.custom.length);
state.paletteId = null;
state.custom = [];
g.handleAction("prune-custom", el({}));
t("tombol bersih-bersih berjalan", Array.isArray(state.custom));
state.custom = [{ id: "z1", name: "Buang", genres: [], feels: [], colors: { base: "#101010", surface: "#202020", accent: "#F0F0F0", ink: "#FFFFFF", muted: "#808080" }, note: "" }];
g.handleAction("del-palette", el({ "data-id": "z1" }));
t("hapus palet simpanan bekerja", state.custom.length === 0);

/* ---------------- 9. deskriptor batchPlay ---------------- */

section("== 9. Deskriptor batchPlay ==");
function has(re) { return re.test(src); }
function none(re) { return !re.test(src); }
t("fill dokumen memakai enum", has(/fill\s*[:=]\s*\{\s*_enum:\s*"fill"/) && none(/_obj:\s*"white"/));
t("mode dokumen memakai _class", has(/mode\s*[:=]\s*\{\s*_class:\s*"RGBColorMode"/) && none(/mode:\s*\{\s*_obj:/));
t("depth 8-bit dipaksa (default PS sudah 8-bit)", none(/depth:\s*8[,\s]/));
t("autoKern (enum) menggantikan kunci lama", has(/autoKern\s*=\s*\{\s*_enum:\s*"autoKern"/) && none(/autoKerning\s*[:=]/));
t("justification dibungkus enum", has(/justification:\s*\{\s*_enum:\s*"alignmentType"/));
t("dokumen dibuat via API inti lebih dulu, batchPlay jadi cadangan", has(/(docs|documents)\.add\(/) && has(/viaCore\(\)\.then\(/));
t("baca ukuran dokumen lewat AM (satuan asli)", has(/_props:\s*\["width",\s*"height",\s*"resolution"\]/) && has(/function toPixels\(/));
t("make text layer punya jalur fallback", has(/textLayerDesc\(o,\s*true[\s\S]{0,300}textLayerDesc\(o,\s*false/));
t("ada jalur tutup dokumen uji tanpa menyimpan", has(/saving:\s*\{\s*_enum:\s*"yesNo",\s*_value:\s*"no"\s*\}/));
t("set warna memakai _ref: color (sesuai kode Adobe)", has(/_ref:\s*"color",\s*_property:/));
t("kirim ke belakang memakai ordinal back", has(/_ref:\s*"layer",\s*_enum:\s*"ordinal",\s*_value:\s*"back"/));
t("ada uji aksi di panel", has(/function runSelfTest/) && has(/selfTest:\s*selfTest/));

t("penyalinan menunggu hasil clipboard", has(/function copyWithStatus\(/) && has(/return viaNav\(\)\.then\(/));
t("ada pegang debug untuk konsol UXP", has(/window\.SAMPUL\s*=/));

section("== 10. Bawaan lama yang harus hilang ==");
t("README tidak lagi mengklaim 94 KB", fs.readFileSync(path.join(ROOT, "README.md"), "utf8").indexOf("94 KB") < 0);
const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
t("manifest v1.4.0", man.version === "1.4.0", "-> " + man.version);
t("manifest: izin clipboard + berkas untuk pemilih file (sesuai panel bawaan Adobe)",
  man.requiredPermissions.localFileSystem === "fullAccess" && man.requiredPermissions.clipboard === "readAndWrite",
  "-> " + JSON.stringify(man.requiredPermissions));
t("manifest punya ikon", Array.isArray(man.icons) && man.icons.length === 2);
t("file ikon ada (termasuk varian @1x yang dicari UXP)",
  ["icon_D.png", "icon_D@1x.png", "icon_D@2x.png", "icon_N.png", "icon_N@1x.png", "icon_N@2x.png"]
    .every(function (f) { return fs.existsSync(path.join(ROOT, "icons", f)); }));
t("host berupa objek (bukan array)", !Array.isArray(man.host) && man.host.app === "PS");

section("== 11. Liput penuh (fitur v1.4) ==");
{
  const save = JSON.parse(JSON.stringify(g.T.state.wrap));
  const reset = function (patch) {
    Object.assign(g.T.state.wrap, { format: "kdp", paper: "putih", pages: 180, bleed: "in125", spine: true }, patch);
  };
  reset({});
  const G = g.T.wrapGeom();
  t("sheet = bleed + trim belakang + punggung + trim depan + bleed",
    G.totalW === 2 * G.bleedPx + 2 * G.trimW + G.spinePx,
    "-> " + G.totalW + " = 2*" + G.bleedPx + " + 2*" + G.trimW + " + " + G.spinePx);
  t("tinggi sheet = bleed + trim + bleed",
    G.totalH === 2 * G.bleedPx + G.trimH, "-> " + G.totalH);
  t("punggung 180 hal kertas putih = 11,43 mm", Math.abs(G.spineMm - 0.0635 * 180) < 0.01,
    "-> " + G.spineMm.toFixed(2) + " mm");
  t("panel belakang/punggung/depan berurutan tanpa celah",
    G.back.x1 === G.spine.x0 && G.spine.x1 === G.front.x0 && G.front.x1 === G.totalW - G.bleedPx);
  t("teks punggung dilarang di bawah patokan halaman format",
    G.spineTextOk === (180 >= G.format.spineTextPages), "-> " + G.spineTextOk);
  reset({ pages: 70 });
  t("peringatan untuk teks punggung yang terlalu sempit",
    g.T.wrapGeom().warnings.some(function (w) { return /jilid|punggung/i.test(w); }),
    "-> " + JSON.stringify(g.T.wrapGeom().warnings));
  reset({ pages: 320 });
  const G2 = g.T.wrapGeom();
  t("halaman 320: teks punggung boleh", G2.spineTextOk && !G2.warnings.some(function (w) { return /jilid|punggung/i.test(w); }));
  reset({ pages: 5 });
  t("halaman di bawah minimum format diberi peringatan",
    g.T.wrapGeom().warnings.some(function (w) { return /minimum/i.test(w); }));
  reset({ bleed: "none" });
  t("bleed 0 diberi peringatan",
    g.T.wrapGeom().warnings.some(function (w) { return /bleed/i.test(w); }));
  reset({ paper: "krem", pages: 320 });
  t("kertas krem 320 hal = 25,4 mm", Math.abs(g.T.wrapGeom().spineMm - 0.0794 * 320) < 0.02,
    "-> " + g.T.wrapGeom().spineMm.toFixed(2) + " mm");
  t("garis panduan trim = 5 vertikal + 2 horizontal",
    (function () { const l = g.T.wrapGuideLines(g.T.wrapGeom()); return l.filter(function (x) { return x.o === "vertical"; }).length === 5 && l.filter(function (x) { return x.o === "horizontal"; }).length === 2; })());
  reset(save);
}

section("== 12. Ekstraksi warna dari sampel ==");
{
  t("sampel kosong -> null", g.T.paletteFromSamples([]) === null && g.T.paletteFromSamples(null) === null);
  const samples = [];
  for (let i = 0; i < 14; i++) samples.push("#141820");
  for (let i = 0; i < 4; i++) samples.push("#2E3A4A");
  samples.push("#E23E3E", "#C7A45A");
  const pal = g.T.paletteFromSamples(samples);
  t("menghasilkan 5 peran hex valid", pal && ["base", "surface", "accent", "ink", "muted"].every(function (k) { return /^#[0-9A-F]{6}$/.test(pal.colors[k]); }),
    "-> " + JSON.stringify(pal.colors));
  t("base = warna paling sering", pal.colors.base === "#141820", "-> " + pal.colors.base);
  t("aksen bukan warna latar", pal.colors.accent !== pal.colors.base, "-> " + pal.colors.accent);
  t("ink kontras >= 4,5:1 di atas base", g.contrastRatio(pal.colors.ink, pal.colors.base) >= 4.5,
    "-> " + g.contrastRatio(pal.colors.ink, pal.colors.base).toFixed(2) + ":1");
  const flat = g.T.paletteFromSamples(["#808080", "#808080"]);
  t("sampel satu warna tetap sah (ink dipaksa kontras)",
    flat && g.contrastRatio(flat.colors.ink, flat.colors.base) >= 4.5,
    "-> ink " + flat.colors.ink);
}

section("== 13. Proyek .sampul.json ==");
{
  const st = g.T.state;
  st.cover.title = "JUDUL UJI PROYEK";
  st.wrap.pages = 250;
  st.wrap.publisher = "Penerbit Uji";
  st.wrap.isbn = "978-602-0000-00-0";
  st.genScheme = "triadic";
  st.genTone = "light";
  const json = g.T.serializeProject();
  const d = JSON.parse(json);
  t("berkas proyek punya kind yang benar", d.kind === "sampul.project" && !!d.state && !!d.computed);
  t("geometri ikut tercatat di proyek", typeof d.computed.wrapGeom.totalW === "number" && d.computed.wrapGeom.dpi > 0);
  st.cover.title = "BERUBAH";
  st.wrap.pages = 10;
  st.wrap.publisher = "";
  const err = g.T.applyProject(json);
  t("applyProject tidak error", err === null, "-> " + err);
  t("nilai pulih dari proyek",
    st.cover.title === "JUDUL UJI PROYEK" && st.wrap.pages === 250 && st.wrap.publisher === "Penerbit Uji" && st.wrap.isbn === "978-602-0000-00-0");
  t("skema generator ikut pulih", st.genScheme === "triadic" && st.genTone === "light");
  t("berkas asal ditolak dengan pesan jelas",
    typeof g.T.applyProject("bukan json") === "string" && typeof g.T.applyProject(JSON.stringify({ kind: "lain" })) === "string");
}

section("== 14. Aksi baru di panel ==");
["build-wrap", "wrap-guides", "extract-colors", "export-pdf", "export-jpg", "export-png", "export-psd",
  "export-thumb", "save-project", "open-project", "toggle-spine"]
  .forEach(function (act) {
    t("aksi ada: " + act, has(new RegExp('case "' + act + '"')) && new RegExp('data-act="' + act + '"').test(HTML));
  });
/* Chip pilihan dirender oleh JS, jadi yang dicek adalah pemakaian chipHTML-nya. */
["pick-format", "pick-paper", "pick-bleed"].forEach(function (act) {
  t("chip aksi ada: " + act, has(new RegExp('case "' + act + '"')) && has(new RegExp('"' + act + '",')));
});
t("tab Cetak & Ekspor ada di HTML", /data-pane="cetak"/.test(HTML) && /data-tab="cetak"/.test(HTML));
t("ekspansi sampler dibatasi 10 per ronde (batas PS 28.2)",
  has(/SAMPLER_MAX\s*=\s*10/) && has(/gridPoints\(/));
t("baca warna sampler lewat colorSamplerList (bukan get per-sampler)",
  has(/_props:\s*\["colorSamplerList"\]/) && none(/putIndex\(sid\("colorSampler"\)/));
t("saveAs memakai file token UXP, AM jadi cadangan",
  has(/getFileForSaving/) && has(/doc\.saveAs\[/) && has(/PNGFormat/));

console.log("\n" + "-".repeat(52));
console.log("HASIL: " + ok + " lolos, " + bad + " gagal");
if (bad) {
  console.log("\nYang gagal:");
  fails.forEach(function (f) { console.log(" - " + f); });
  process.exit(1);
}
console.log("Semua pemeriksaan lolos.");
