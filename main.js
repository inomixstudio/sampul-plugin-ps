"use strict";

/* =========================================================
   SAMPUL — palet & tipografi untuk sampul buku
   Panel UXP untuk Adobe Photoshop
   ---------------------------------------------------------
   1. Data      : kategori, rasa, palet, pasangan font, preset
   2. Warna     : konversi OKLCH, kontras WCAG, generator
   3. Photoshop : jembatan batchPlay (semua dibungkus try/catch,
                  plugin tetap jalan tanpa Photoshop / mode demo)
   4. State     : pilihan aktif + penyimpanan lokal
   5. Rekomendasi
   6. Render
   7. Aksi Photoshop
   8. Event & init
   ========================================================= */

/* ============================ 1. DATA ============================ */

const APP_VERSION = "1.4.0";

const GENRES = [
  { id: "sastra",   label: "Sastra",    hint: "Fiksi literer, novel terjemahan" },
  { id: "thriller", label: "Thriller",  hint: "Misteri, kriminal, suspense" },
  { id: "romansa",  label: "Romansa",   hint: "Drama romantis, chick-lit" },
  { id: "fantasi",  label: "Fantasi",   hint: "Fantasi epik, magical realism" },
  { id: "scifi",    label: "Sci-Fi",    hint: "Fiksi ilmiah, distopia" },
  { id: "nonfiksi", label: "Non-Fiksi", hint: "Bisnis, sains populer, self-help" },
  { id: "anak",     label: "Anak",      hint: "Buku bergambar, remaja awal" },
  { id: "horor",    label: "Horor",     hint: "Horor, gotik, supernatural" },
  { id: "sejarah",  label: "Sejarah",   hint: "Biografi, memoar, sejarah" },
  { id: "puisi",    label: "Puisi",     hint: "Puisi, esai, buku seni" }
];

const FEELS = [
  { id: "elegan",     label: "Elegan" },
  { id: "romantis",   label: "Romantis" },
  { id: "tegas",      label: "Tegas" },
  { id: "misterius",  label: "Misterius" },
  { id: "hangat",     label: "Hangat" },
  { id: "ceria",      label: "Ceria" },
  { id: "minimal",    label: "Minimal" },
  { id: "nostalgik",  label: "Nostalgik" },
  { id: "dramatis",   label: "Dramatis" },
  { id: "futuristik", label: "Futuristik" }
];

const ROLES = [
  { key: "base",    label: "Latar", hint: "area terbesar, 60%" },
  { key: "surface", label: "Blok",  hint: "panel, pita, kotak, 30%" },
  { key: "accent",  label: "Aksen", hint: "judul, garis, 10%" },
  { key: "ink",     label: "Tinta", hint: "teks utama" },
  { key: "muted",   label: "Redup", hint: "teks sekunder, kredit" }
];

const SCHEMES = {
  analogous:     { label: "Analog",             fn: function (h) { return [h, h + 28, h - 28, h + 56]; } },
  complementary: { label: "Komplementer",       fn: function (h) { return [h, h + 180, h + 12, h + 192]; } },
  split:         { label: "Split-komplementer", fn: function (h) { return [h, h + 150, h + 210, h + 30]; } },
  triadic:       { label: "Triadik",            fn: function (h) { return [h, h + 120, h + 240, h + 60]; } },
  mono:          { label: "Monokrom",           fn: function (h) { return [h, h, h, h]; } }
};

const PRESETS = {
  "6x9":     { label: "6 x 9 in (novel)",      w: 1800, h: 2700, dpi: 300, trimIn: [6, 9] },
  "5.5x8.5": { label: "5,5 x 8,5 in (novel)",  w: 1650, h: 2550, dpi: 300, trimIn: [5.5, 8.5] },
  "a5":      { label: "A5 / 148 x 210 mm",     w: 1748, h: 2480, dpi: 300, trimIn: null },
  "5x8":     { label: "5 x 8 in",              w: 1500, h: 2400, dpi: 300, trimIn: [5, 8] },
  "ebook":   { label: "E-book 1600 x 2560 px", w: 1600, h: 2560, dpi: 300, trimIn: null }
};

/* ---- sampul liput penuh: kertas, lebarkan jilid, lalu bleed ---- */

/* Tebal per halaman dari tabel KDP (satuan mm/halaman). Cetak offset lain bisa beda,
   jadi angka ini dipakai sebagai patokan, bukan jaminan. */
const PAPERS = {
  putih: { label: "Kertas putih", mmPerPage: 0.0635, note: "0,0025 in/halaman (KDP)" },
  krem:  { label: "Kertas krem",  mmPerPage: 0.0794, note: "0,003125 in/halaman (KDP)" },
  warna: { label: "Warna premium", mmPerPage: 0.1016, note: "0,004 in/halaman (KDP)" }
};

const WRAP_FORMATS = {
  kdp:      { label: "KDP paperback", bleed: "in125", minPages: 24, spineTextPages: 100, barcodeIn: [2, 1.2] },
  bookbaby: { label: "BookBaby",      bleed: "in125", minPages: 24, spineTextPages: 80,  barcodeIn: [2, 1.2] },
  offset:   { label: "Offset umum",   bleed: "b3",    minPages: 16, spineTextPages: 80,  barcodeIn: [2, 1.2] }
};

const BLEEDS = {
  none:  { label: "Tanpa bleed", mm: 0 },
  b3:    { label: "3 mm",        mm: 3 },
  b5:    { label: "5 mm",        mm: 5 },
  in125: { label: "0,125 in",    mm: 3.175 }
};

const MM_IN = 25.4;

/* Geometri murni: semua dalam piksel pada dpi preset, plus pembacaan mm/in. */
function wrapGeom() {
  var preset = PRESETS[state.cover.preset] || PRESETS["6x9"];
  var w = state.wrap;
  var paper = PAPERS[w.paper] || PAPERS.putih;
  var fmt = WRAP_FORMATS[w.format] || WRAP_FORMATS.kdp;
  var bleed = BLEEDS[w.bleed] || BLEEDS.none;
  var dpi = preset.dpi || 300;
  var pages = clamp(Math.round(Number(w.pages) || 0), 0, 3000);

  var pxPerMm = dpi / MM_IN;
  var spineMm = paper.mmPerPage * pages;
  var spinePx = Math.round(spineMm * pxPerMm);
  var bleedPx = Math.round(bleed.mm * pxPerMm);
  var trimW = preset.w, trimH = preset.h;
  var totalW = bleedPx * 2 + trimW * 2 + spinePx;
  var totalH = bleedPx * 2 + trimH;

  var back = { x0: bleedPx, x1: bleedPx + trimW };
  var spine = { x0: back.x1, x1: back.x1 + spinePx };
  var front = { x0: spine.x1, x1: spine.x1 + trimW };

  var barcodeW = Math.round((fmt.barcodeIn[0] || 2) * dpi);
  var barcodeH = Math.round((fmt.barcodeIn[1] || 1.2) * dpi);
  var barcodePad = Math.round(0.25 * dpi);

  var warn = [];
  if (pages < fmt.minPages) warn.push("Halaman kurang dari minimum " + fmt.minPages + " untuk " + fmt.label + ".");
  if (w.spine && pages < fmt.spineTextPages) warn.push("Jilid " + spineMm.toFixed(1) + " mm terlalu sempit untuk teks (umumnya butuh " + fmt.spineTextPages + " halaman).");
  if (!bleed.mm) warn.push("Bleed 0: tepi tidak menyisakan kertas potong.");
  if (trimW * 2 + spinePx > 8000) warn.push("Lebar sheet sangat besar; komputer lama bisa lambat.");

  return {
    dpi: dpi, pages: pages, paper: paper, format: fmt, bleed: bleed,
    trimW: trimW, trimH: trimH, spinePx: spinePx, spineMm: spineMm, spineIn: spineMm / MM_IN,
    bleedPx: bleedPx, totalW: totalW, totalH: totalH,
    back: back, spine: spine, front: front,
    barcode: { w: barcodeW, h: barcodeH, pad: barcodePad, x0: back.x0 + barcodePad, y0: totalH - bleedPx - barcodePad - barcodeH },
    spineTextOk: pages >= fmt.spineTextPages,
    mm: { totalW: totalW / pxPerMm, totalH: totalH / pxPerMm, trimW: trimW / pxPerMm, trimH: trimH / pxPerMm, bleed: bleed.mm },
    inch: { totalW: totalW / dpi, totalH: totalH / dpi },
    warnings: warn
  };
}

/* Palet kurasi: 5 peran warna + catatan kenapa terasa begitu. */
const PALETTES = [
  { id: "kertas-tua", name: "Kertas Tua", genres: ["sastra", "sejarah", "puisi"], feels: ["nostalgik", "elegan", "hangat"],
    colors: { base: "#F2EBDD", surface: "#E0D3BC", accent: "#A6392E", ink: "#231E19", muted: "#6E6255" },
    note: "Krem kertas + aksen bata: terasa buku lama yang dirawat. Bata menarik mata ke judul tanpa berteriak." },

  { id: "tinta-malam", name: "Tinta Malam", genres: ["sastra", "sejarah"], feels: ["elegan", "misterius", "dramatis"],
    colors: { base: "#14161A", surface: "#1F242B", accent: "#C7A45A", ink: "#F3EFE6", muted: "#8E8A80" },
    note: "Hampir hitam dengan emas pudar: mewah tapi tidak norak. Cocok untuk judul serif besar." },

  { id: "botani-pudar", name: "Botani Pudar", genres: ["sastra", "nonfiksi", "anak"], feels: ["hangat", "minimal", "elegan"],
    colors: { base: "#E8EDE4", surface: "#C9D6C4", accent: "#3F5D4B", ink: "#1B241E", muted: "#5E6F62" },
    note: "Hijau sage menenangkan; bagus untuk tema alam, wellness, dan memoar yang jujur." },

  { id: "neon-noir", name: "Neon Noir", genres: ["thriller", "horor"], feels: ["tegas", "misterius", "dramatis"],
    colors: { base: "#0B0E13", surface: "#151B24", accent: "#E23E3E", ink: "#F5F6F7", muted: "#7C8794" },
    note: "Hitam biru + merah menyala: ketegangan kota malam. Biarkan aksen hanya untuk judul dan satu garis." },

  { id: "sirene-malam", name: "Sirene Malam", genres: ["thriller", "scifi"], feels: ["misterius", "dramatis", "tegas"],
    colors: { base: "#101820", surface: "#1B2A38", accent: "#F2B705", ink: "#EDF1F5", muted: "#7E8C99" },
    note: "Amber di atas biru malam terasa seperti lampu darurat — waspada, tapi tetap elegan." },

  { id: "darah-beku", name: "Darah Beku", genres: ["thriller", "horor"], feels: ["tegas", "minimal", "misterius"],
    colors: { base: "#F4F4F2", surface: "#E2E4E6", accent: "#B21E28", ink: "#101114", muted: "#62666B" },
    note: "Putih dingin + merah darah: kengerian yang bersih. Sedikit warna justru lebih mengganggu." },

  { id: "blush-lembut", name: "Blush Lembut", genres: ["romansa"], feels: ["romantis", "hangat", "minimal"],
    colors: { base: "#FBEDEA", surface: "#F3D6CF", accent: "#C4576A", ink: "#2A1B1E", muted: "#7E6167" },
    note: "Rose lembut dengan tinta marun: hangat dan personal, tidak kekanak-kanakan." },

  { id: "senja-ungu", name: "Senja Ungu", genres: ["romansa", "fantasi"], feels: ["romantis", "dramatis", "misterius"],
    colors: { base: "#1B1024", surface: "#2E1B3C", accent: "#F09A8B", ink: "#FBEFE9", muted: "#A08CA8" },
    note: "Ungu tua + persik: romansa yang sedikit magis. Aksen persik terbaca jelas di latar gelap." },

  { id: "mawar-klasik", name: "Mawar Klasik", genres: ["romansa", "sejarah", "sastra"], feels: ["elegan", "romantis", "nostalgik"],
    colors: { base: "#F7F1E8", surface: "#E9D8CC", accent: "#8E3B51", ink: "#241A1B", muted: "#6B5A56" },
    note: "Wine di atas ivory: roman periode. Pakai serif ber-kontras tinggi dengan tracking lebar." },

  { id: "hutan-kuno", name: "Hutan Kuno", genres: ["fantasi", "sejarah"], feels: ["dramatis", "misterius", "nostalgik"],
    colors: { base: "#101A16", surface: "#1B2A22", accent: "#C9A227", ink: "#EEF3E6", muted: "#83998A" },
    note: "Hijau lumut dalam + emas tua: epik yang berakar pada mitos, bukan kilau modern." },

  { id: "permata-malam", name: "Permata Malam", genres: ["fantasi", "scifi"], feels: ["dramatis", "misterius", "futuristik"],
    colors: { base: "#171227", surface: "#251C3E", accent: "#7ED9C3", ink: "#F0EDF7", muted: "#9A93B5" },
    note: "Violet dalam + mint: sihir yang terasa seperti teknologi. Kontras aksen sangat tinggi." },

  { id: "perkamen-sihir", name: "Perkamen Sihir", genres: ["fantasi", "anak", "sejarah"], feels: ["nostalgik", "hangat", "dramatis"],
    colors: { base: "#F1E6CE", surface: "#DCC9A6", accent: "#4A6B8A", ink: "#241E16", muted: "#6E6151" },
    note: "Perkamen + biru pudar: petualangan buku lama, ramah untuk pembaca muda." },

  { id: "ruang-hampa", name: "Ruang Hampa", genres: ["scifi"], feels: ["futuristik", "tegas", "minimal"],
    colors: { base: "#05070A", surface: "#0E1620", accent: "#35D0E0", ink: "#E9F4F7", muted: "#6C7F8C" },
    note: "Hitam mutlak + sian: satu-satunya warna terang jadi pusat perhatian. Jangan tambah warna ketiga." },

  { id: "terminal-hijau", name: "Terminal Hijau", genres: ["scifi", "thriller"], feels: ["futuristik", "misterius", "tegas"],
    colors: { base: "#0A100C", surface: "#12201A", accent: "#57E08A", ink: "#E8F5EC", muted: "#729485" },
    note: "Hijau fosfor di atas hitam: referensi layar lama, terasa teknis dan sedikit mengancam." },

  { id: "kapsul-putih", name: "Kapsul Putih", genres: ["scifi", "nonfiksi"], feels: ["minimal", "futuristik", "elegan"],
    colors: { base: "#EDF1F5", surface: "#D7DEE6", accent: "#2D5BE3", ink: "#0E1420", muted: "#5A6675" },
    note: "Putih bersih + biru listrik: sains yang optimistis. Ruang kosong adalah bagian desainnya." },

  { id: "editorial", name: "Editorial", genres: ["nonfiksi"], feels: ["minimal", "tegas", "futuristik"],
    colors: { base: "#FFFFFF", surface: "#F1F1EF", accent: "#E4572E", ink: "#14151A", muted: "#6A6C72" },
    note: "Putih + oranye terbakar: gaya majalah. Tipografi tebal berani, tanpa ornamen lain." },

  { id: "korporat-tenang", name: "Korporat Tenang", genres: ["nonfiksi", "sejarah"], feels: ["elegan", "minimal", "tegas"],
    colors: { base: "#F5F7FA", surface: "#E3E9F0", accent: "#1F4E79", ink: "#101720", muted: "#5C6875" },
    note: "Biru tua di atas abu sejuk: kredibel dan tenang. Aman untuk bisnis, sains, dan biografi." },

  { id: "grafit", name: "Grafit", genres: ["nonfiksi", "thriller"], feels: ["tegas", "minimal", "dramatis"],
    colors: { base: "#1A1A1C", surface: "#26262A", accent: "#F2C14E", ink: "#F4F4F6", muted: "#96969C" },
    note: "Abu grafit + kuning sinyal: pemberhentian mata di rak. Sangat cocok untuk judul kapital." },

  { id: "krayon", name: "Krayon", genres: ["anak"], feels: ["ceria", "hangat", "dramatis"],
    colors: { base: "#FFF6E0", surface: "#FFE6B3", accent: "#DF4F28", ink: "#2B2118", muted: "#7A6A58" },
    note: "Kuning kertas + coral: hangat seperti buku cerita yang sering dibuka. Tinta tetap gelap agar terbaca." },

  { id: "langit-ceria", name: "Langit Ceria", genres: ["anak", "romansa"], feels: ["ceria", "hangat", "romantis"],
    colors: { base: "#E9F6FF", surface: "#C9E9FF", accent: "#F2547D", ink: "#142233", muted: "#5E7186" },
    note: "Biru langit + pink: ramah dan berenergi. Bagus untuk buku bergambar dan novel remaja." },

  { id: "rumput", name: "Rumput", genres: ["anak", "nonfiksi"], feels: ["ceria", "hangat", "minimal"],
    colors: { base: "#F2FAEC", surface: "#D8F0C7", accent: "#3E7C3A", ink: "#16210F", muted: "#5F7257" },
    note: "Hijau rumput segar: tema alam, berkebun, dan buku aktivitas anak." },

  { id: "kertas-puisi", name: "Kertas Puisi", genres: ["puisi", "sastra"], feels: ["minimal", "elegan", "nostalgik"],
    colors: { base: "#FBF9F4", surface: "#EEE9DD", accent: "#57534E", ink: "#1C1A17", muted: "#6F6A62" },
    note: "Hampir monokrom: biarkan tipografi dan ruang kosong yang bicara. Aksen boleh nyaris tanpa warna." },

  { id: "tinta-embun", name: "Tinta & Embun", genres: ["puisi", "sastra"], feels: ["misterius", "minimal", "elegan"],
    colors: { base: "#0F1417", surface: "#1A2226", accent: "#8FB3A6", ink: "#EFF3F1", muted: "#869896" },
    note: "Hijau kebiruan pucat di latar arang: sunyi, reflektif, tidak muram." },

  { id: "kabut", name: "Kabut", genres: ["horor", "thriller"], feels: ["misterius", "dramatis", "minimal"],
    colors: { base: "#12120F", surface: "#1D1D18", accent: "#CE3B42", ink: "#EDE9E0", muted: "#8A8578" },
    note: "Hitam hangat + merah tua: horor yang berdebu, bukan berdarah. Aksen dipakai sangat sedikit." },

  { id: "tulang", name: "Tulang", genres: ["horor", "puisi"], feels: ["minimal", "misterius", "elegan"],
    colors: { base: "#E7E3D9", surface: "#CFC9BC", accent: "#2B2B2B", ink: "#16150F", muted: "#6A665C" },
    note: "Warna tulang + hitam: gotik pucat. Kontras keras tanpa satu pun warna jenuh." },

  { id: "arsip", name: "Arsip", genres: ["sejarah", "nonfiksi"], feels: ["nostalgik", "elegan", "hangat"],
    colors: { base: "#EFE7D6", surface: "#D9CBB2", accent: "#7B3F2E", ink: "#211A13", muted: "#6B5E4C" },
    note: "Tan + cokelat tembakau: dokumen lama. Aksen bisa dipakai untuk label atau pita arsip." },

  { id: "perunggu", name: "Perunggu", genres: ["sejarah", "fantasi"], feels: ["dramatis", "nostalgik", "elegan"],
    colors: { base: "#14110E", surface: "#221B16", accent: "#B8874B", ink: "#F2EADF", muted: "#93826D" },
    note: "Cokelat hitam + perunggu: epik sejarah. Terasa mahal tanpa harus memakai emas mengilap." },

  { id: "laut-kolonial", name: "Laut Kolonial", genres: ["sejarah", "sastra"], feels: ["elegan", "misterius", "nostalgik"],
    colors: { base: "#0F1A1F", surface: "#17282F", accent: "#C9A227", ink: "#EAF1F2", muted: "#7E939A" },
    note: "Teal dalam + kuning tua: pelayaran dan arsip kolonial. Aksen emas cukup untuk judul dan nomor seri." }
];

/* Pasangan font: 1 judul + 1 teks, masing-masing dengan rantai fallback. */
const PAIRINGS = [
  { id: "playfair-source",
    heading: { family: "Playfair Display", aliases: ["Playfair Display"], boldPS: ["PlayfairDisplay-Black", "PlayfairDisplay-Bold", "MinionPro-Bold", "Georgia-Bold"],
      css: '"Playfair Display","Minion Pro",Georgia,"Times New Roman",serif', case: "upper", tracking: 60 },
    body: { family: "Source Sans 3", aliases: ["Source Sans 3", "Source Sans Pro"], regularPS: ["SourceSans3-Regular", "SourceSansPro-Regular", "SegoeUI", "ArialMT"],
      css: '"Source Sans 3","Source Sans Pro","Segoe UI",Arial,sans-serif', tracking: 10 },
    genres: ["sastra", "romansa", "sejarah", "puisi"],
    feels: ["elegan", "nostalgik", "romantis"],
    why: "Serif ber-kontras tinggi memberi bobot sastra; sans netral menjaga nama penulis tetap tenang.",
    usage: "Judul kapital + tracking 60. Nama penulis 1/3 ukuran judul, tanpa kapital." },

  { id: "cormorant-inter",
    heading: { family: "Cormorant Garamond", aliases: ["Cormorant Garamond", "Cormorant", "EB Garamond", "Garamond", "Adobe Garamond Pro"], boldPS: ["CormorantGaramond-SemiBold", "CormorantGaramond-Bold", "Garamond-Bold", "EBGaramond-Bold", "AGaramondPro-Semibold"],
      css: '"Cormorant Garamond","EB Garamond",Garamond,"Adobe Garamond Pro",Georgia,serif', case: "upper", tracking: 110 },
    body: { family: "Inter", aliases: ["Inter", "Inter Display"], regularPS: ["Inter-Regular", "SegoeUI", "ArialMT"],
      css: 'Inter,"Segoe UI",Arial,sans-serif', tracking: 8 },
    genres: ["puisi", "sastra"],
    feels: ["elegan", "minimal", "hangat"],
    why: "Garamond yang ringan + Inter yang netral: tenang, intelektual, tidak berusaha menarik perhatian.",
    usage: "Tracking judul lebar (100–140) supaya huruf tipis tetap terbaca saat diperkecil di toko online." },

  { id: "dmserif-worksans",
    heading: { family: "DM Serif Display", aliases: ["DM Serif Display", "Playfair Display", "Abril Fatface"], boldPS: ["DMSerifDisplay-Regular", "PlayfairDisplay-Bold", "AbrilFatface-Regular", "Georgia-Bold"],
      css: '"DM Serif Display","Playfair Display","Abril Fatface",Georgia,serif', case: "none", tracking: 8 },
    body: { family: "Work Sans", aliases: ["Work Sans"], regularPS: ["WorkSans-Regular", "WorkSans-Light", "SegoeUI", "ArialMT"],
      css: '"Work Sans","Segoe UI",Arial,sans-serif', tracking: 12 },
    genres: ["romansa", "sastra"],
    feels: ["romantis", "hangat", "elegan"],
    why: "Serif display yang ramah dipadu sans geometris: modern-romantis, tidak manis berlebihan.",
    usage: "Judul sentence case (bukan kapital) agar terasa personal. Subjudul kecil dengan tracking 120." },

  { id: "bebas-barlow",
    heading: { family: "Bebas Neue", aliases: ["Bebas Neue", "BebasNeue"], boldPS: ["BebasNeue-Regular", "Oswald-Bold", "Impact", "ArialNarrow-Bold"],
      css: '"Bebas Neue","Oswald",Impact,Haettenschweiler,"Arial Narrow",sans-serif', case: "upper", tracking: 26 },
    body: { family: "Barlow", aliases: ["Barlow"], regularPS: ["Barlow-Regular", "Barlow-Medium", "SegoeUI", "ArialMT"],
      css: 'Barlow,"Segoe UI",Arial,sans-serif', tracking: 14 },
    genres: ["thriller", "nonfiksi", "sejarah", "scifi"],
    feels: ["tegas", "dramatis", "futuristik", "misterius"],
    why: "Kapital sempit setinggi mungkin + sans ringkas: langsung terasa mendesak dan tegas.",
    usage: "Judul 2–4 baris menumpuk, leading rapat (0,92). Aksen dipakai untuk satu kata saja." },

  { id: "anton-inter",
    heading: { family: "Anton", aliases: ["Anton"], boldPS: ["Anton-Regular", "Impact", "FranklinGothic-Heavy", "Arial-BoldMT"],
      css: 'Anton,Impact,"Franklin Gothic Heavy","Arial Black",sans-serif', case: "upper", tracking: -10 },
    body: { family: "Inter", aliases: ["Inter"], regularPS: ["Inter-Regular", "SegoeUI", "ArialMT"],
      css: 'Inter,"Segoe UI",Arial,sans-serif', tracking: 4 },
    genres: ["thriller", "horor"],
    feels: ["tegas", "dramatis", "misterius"],
    why: "Huruf sangat tebal dan padat: judul jadi objek grafis, bukan sekadar tulisan.",
    usage: "Tracking negatif tipis (-10) agar blok judul rapat. Jangan dipakai untuk teks panjang." },

  { id: "oswald-lora",
    heading: { family: "Oswald", aliases: ["Oswald"], boldPS: ["Oswald-Bold", "Oswald-SemiBold", "ArialNarrow-Bold", "Impact"],
      css: 'Oswald,"Arial Narrow",Impact,sans-serif', case: "upper", tracking: 40 },
    body: { family: "Lora", aliases: ["Lora"], regularPS: ["Lora-Regular", "Lora-Medium", "Georgia", "TimesNewRomanPSMT"],
      css: 'Lora,Georgia,"Times New Roman",serif', tracking: 6 },
    genres: ["nonfiksi", "sejarah", "sastra"],
    feels: ["tegas", "elegan", "nostalgik"],
    why: "Sans condensed untuk judul + serif untuk teks: tegas di rak, nyaman dibaca di tangan.",
    usage: "Cocok untuk non-fiksi dengan judul panjang; pecah judul ke 2 baris, bukan dikecilkan." },

  { id: "librebaskerville-montserrat",
    heading: { family: "Libre Baskerville", aliases: ["Libre Baskerville", "Baskerville", "Playfair Display"], boldPS: ["LibreBaskerville-Bold", "Baskerville-Bold", "Georgia-Bold"],
      css: '"Libre Baskerville",Baskerville,"Playfair Display",Georgia,serif', case: "upper", tracking: 80 },
    body: { family: "Montserrat", aliases: ["Montserrat"], regularPS: ["Montserrat-Regular", "Montserrat-Light", "SegoeUI", "ArialMT"],
      css: 'Montserrat,"Segoe UI",Arial,sans-serif', tracking: 30 },
    genres: ["sastra", "nonfiksi"],
    feels: ["elegan", "minimal", "nostalgik"],
    why: "Baskerville memberi kredibilitas klasik; Montserrat dengan tracking lebar terasa modern dan mahal.",
    usage: "Tracking lebar di nama penulis dan subjudul (150–200) — ini yang membuat kesan premium." },

  { id: "cinzel-ebgaramond",
    heading: { family: "Cinzel", aliases: ["Cinzel", "Cinzel Decorative"], boldPS: ["Cinzel-Bold", "Cinzel-Black", "TrajanPro3-Bold", "TrajanPro-Bold", "TimesNewRomanPS-BoldMT"],
      css: 'Cinzel,"Trajan Pro 3","Trajan Pro","Times New Roman",serif', case: "upper", tracking: 90 },
    body: { family: "EB Garamond", aliases: ["EB Garamond", "Garamond", "Adobe Garamond Pro", "Cormorant Garamond"], regularPS: ["EBGaramond-Regular", "Garamond", "AGaramondPro-Regular", "Georgia"],
      css: '"EB Garamond",Garamond,"Adobe Garamond Pro",Georgia,serif', tracking: 10 },
    genres: ["fantasi", "sejarah"],
    feels: ["dramatis", "nostalgik", "elegan"],
    why: "Kapital Romawi + Garamond: bahasa visual epik dan kuno, seperti prasasti dan naskah.",
    usage: "Judul kapital dengan tracking 90–130. Tambah garis tipis 1 px untuk kesan monumen." },

  { id: "spectral-karla",
    heading: { family: "Spectral", aliases: ["Spectral"], boldPS: ["Spectral-Bold", "Spectral-SemiBold", "Georgia-Bold"],
      css: 'Spectral,Georgia,"Times New Roman",serif', case: "none", tracking: 0 },
    body: { family: "Karla", aliases: ["Karla", "Work Sans", "Nunito", "Inter"], regularPS: ["Karla-Regular", "WorkSans-Regular", "Nunito-Regular", "SegoeUI", "ArialMT"],
      css: 'Karla,"Work Sans",Nunito,Inter,"Segoe UI",Arial,sans-serif', tracking: 12 },
    genres: ["sastra", "nonfiksi"],
    feels: ["minimal", "elegan", "hangat"],
    why: "Serif layar yang jujur + sans bergaya tulisan tangan kecil: hangat, kontemporer, tidak berlebihan.",
    usage: "Biarkan judul sentence case dan kecil; kekuatan ada di ruang kosong, bukan ukuran." },

  { id: "abril-raleway",
    heading: { family: "Abril Fatface", aliases: ["Abril Fatface"], boldPS: ["AbrilFatface-Regular", "PlayfairDisplay-Black", "Georgia-Bold"],
      css: '"Abril Fatface","Playfair Display",Georgia,serif', case: "none", tracking: -5 },
    body: { family: "Raleway", aliases: ["Raleway", "Montserrat", "Poppins", "Open Sans"], regularPS: ["Raleway-Regular", "Montserrat-Light", "Poppins-Light", "SegoeUI", "ArialMT"],
      css: 'Raleway,Montserrat,Poppins,"Open Sans","Segoe UI",Arial,sans-serif', tracking: 40 },
    genres: ["romansa", "sejarah"],
    feels: ["romantis", "dramatis", "nostalgik"],
    why: "Didone gemuk memberi drama; Raleway tipis ber-tracking lebar menyeimbangkannya jadi elegan.",
    usage: "Satu kata judul diberi warna aksen; sisanya tinta. Tracking body 120+." },

  { id: "fraunces-dmsans",
    heading: { family: "Fraunces", aliases: ["Fraunces"], boldPS: ["Fraunces-Black", "Fraunces-Bold", "Fraunces-SemiBold", "Georgia-Bold"],
      css: 'Fraunces,Georgia,"Times New Roman",serif', case: "none", tracking: 0 },
    body: { family: "DM Sans", aliases: ["DM Sans", "Inter", "Work Sans", "Poppins"], regularPS: ["DMSans-Regular", "Inter-Regular", "WorkSans-Regular", "SegoeUI", "ArialMT"],
      css: '"DM Sans",Inter,"Work Sans",Poppins,"Segoe UI",Arial,sans-serif', tracking: 10 },
    genres: ["sastra", "nonfiksi", "romansa"],
    feels: ["hangat", "elegan", "minimal"],
    why: "Serif lembut dengan detail aneh yang ramah: terasa indie dan manusiawi, bukan korporat.",
    usage: "Judul besar dengan leading rapat dan satu kata italic untuk penekanan." },

  { id: "spacegrotesk-inter",
    heading: { family: "Space Grotesk", aliases: ["Space Grotesk"], boldPS: ["SpaceGrotesk-Bold", "SpaceGrotesk-Medium", "SegoeUI-Bold", "Arial-BoldMT"],
      css: '"Space Grotesk","Segoe UI",Arial,sans-serif', case: "upper", tracking: 30 },
    body: { family: "Inter", aliases: ["Inter"], regularPS: ["Inter-Regular", "Inter-Light", "SegoeUI", "ArialMT"],
      css: 'Inter,"Segoe UI",Arial,sans-serif', tracking: 10 },
    genres: ["scifi", "nonfiksi"],
    feels: ["futuristik", "minimal", "tegas", "misterius"],
    why: "Sans geometris dengan detail teknis: futuristik tanpa jatuh ke klise fiksi ilmiah.",
    usage: "Judul kapital, tracking 30–50, subjudul 1/4 ukuran dengan warna redup." },

  { id: "orbitron-rajdhani",
    heading: { family: "Orbitron", aliases: ["Orbitron", "Space Grotesk", "Bahnschrift Condensed"], boldPS: ["Orbitron-Bold", "Orbitron-Black", "Bahnschrift-Bold", "SpaceGrotesk-Bold", "Eurostile-Bold"],
      css: 'Orbitron,"Space Grotesk",Bahnschrift,"Segoe UI",sans-serif', case: "upper", tracking: 70 },
    body: { family: "Rajdhani", aliases: ["Rajdhani", "Bahnschrift", "Space Grotesk", "Barlow Condensed"], regularPS: ["Rajdhani-Regular", "Bahnschrift", "SpaceGrotesk-Regular", "SegoeUI"],
      css: 'Rajdhani,Bahnschrift,"Space Grotesk","Segoe UI",sans-serif', tracking: 20 },
    genres: ["scifi", "anak"],
    feels: ["futuristik", "tegas", "dramatis", "misterius"],
    why: "Huruf berteknologi + body kotak: bahasa antarmuka kapal antariksa. Gunakan dengan disiplin.",
    usage: "Kapital semua dengan tracking 70+. Jangan dipakai untuk blurb panjang." },

  { id: "archivo-archivo",
    heading: { family: "Archivo Black", aliases: ["Archivo Black", "Archivo", "Anton"], boldPS: ["ArchivoBlack-Regular", "Archivo-Black", "Anton-Regular", "Arial-Black", "Impact"],
      css: '"Archivo Black",Archivo,Anton,"Arial Black",Arial,sans-serif', case: "upper", tracking: -8 },
    body: { family: "Archivo", aliases: ["Archivo", "Inter", "Work Sans", "Barlow"], regularPS: ["Archivo-Regular", "Inter-Regular", "WorkSans-Regular", "SegoeUI", "ArialMT"],
      css: 'Archivo,Inter,"Work Sans","Segoe UI",Arial,sans-serif', tracking: 6 },
    genres: ["nonfiksi", "thriller"],
    feels: ["tegas", "minimal", "dramatis"],
    why: "Satu keluarga, dua bobot ekstrem: tebal untuk judul, reguler untuk teks — sangat koheren.",
    usage: "Trik paling aman: satu keluarga font, beda bobot saja." },

  { id: "baloo-nunito",
    heading: { family: "Baloo 2", aliases: ["Baloo 2", "Baloo 2 Display", "Baloo", "Fredoka", "Nunito"], boldPS: ["Baloo2-Bold", "Baloo2-ExtraBold", "Nunito-Bold", "ComicSansMS-Bold", "Verdana-Bold"],
      css: '"Baloo 2",Baloo,"Comic Sans MS",Verdana,sans-serif', case: "none", tracking: 0 },
    body: { family: "Nunito", aliases: ["Nunito"], regularPS: ["Nunito-Regular", "Nunito-SemiBold", "Verdana", "SegoeUI"],
      css: 'Nunito,Verdana,"Segoe UI",sans-serif', tracking: 6 },
    genres: ["anak"],
    feels: ["ceria", "hangat"],
    why: "Huruf membulat dan ramah: terasa seperti gambar tangan, disukai anak dan orang tua.",
    usage: "Judul boleh dua warna; satu kata ditekankan dengan warna aksen dan rotasi ringan." },

  { id: "fredoka-nunito",
    heading: { family: "Fredoka", aliases: ["Fredoka", "Fredoka One", "Baloo 2", "Nunito"], boldPS: ["Fredoka-SemiBold", "FredokaOne-Regular", "Nunito-Bold", "ComicSansMS-Bold", "Verdana-Bold"],
      css: 'Fredoka,"Fredoka One","Comic Sans MS",Verdana,sans-serif', case: "none", tracking: 4 },
    body: { family: "Nunito", aliases: ["Nunito"], regularPS: ["Nunito-Regular", "Nunito-SemiBold", "Verdana", "SegoeUI"],
      css: 'Nunito,Verdana,"Segoe UI",sans-serif', tracking: 6 },
    genres: ["anak"],
    feels: ["ceria", "hangat", "minimal"],
    why: "Geometris membulat: ceria tapi lebih rapi daripada font kartun. Aman untuk buku edukasi.",
    usage: "Satu warna aksen untuk judul sudah cukup; hindari gradasi." },

  { id: "merriweather-opensans",
    heading: { family: "Merriweather", aliases: ["Merriweather", "Lora", "Spectral", "Georgia Pro"], boldPS: ["Merriweather-Black", "Merriweather-Bold", "Lora-Bold", "GeorgiaPro-Bold", "Georgia-Bold"],
      css: 'Merriweather,Lora,Spectral,Georgia,"Times New Roman",serif', case: "none", tracking: 0 },
    body: { family: "Open Sans", aliases: ["Open Sans"], regularPS: ["OpenSans-Regular", "OpenSans-Light", "SegoeUI", "ArialMT"],
      css: '"Open Sans","Segoe UI",Arial,sans-serif', tracking: 8 },
    genres: ["nonfiksi", "sejarah", "sastra"],
    feels: ["elegan", "minimal"],
    why: "Serif tebal yang sangat terbaca + sans netral: pilihan aman untuk non-fiksi serius.",
    usage: "Judul dua baris maksimal; ukuran teks penulis cukup 1/4 judul." },

  { id: "poppins-poppins",
    heading: { family: "Poppins", aliases: ["Poppins"], boldPS: ["Poppins-SemiBold", "Poppins-Bold", "Poppins-Medium", "SegoeUI-Bold"],
      css: 'Poppins,"Segoe UI",Arial,sans-serif', case: "none", tracking: 10 },
    body: { family: "Poppins", aliases: ["Poppins"], regularPS: ["Poppins-Light", "Poppins-Regular", "SegoeUI-Light", "SegoeUI"],
      css: 'Poppins,"Segoe UI",Arial,sans-serif', tracking: 16 },
    genres: ["nonfiksi", "scifi", "romansa"],
    feels: ["minimal", "futuristik", "elegan"],
    why: "Satu keluarga geometris dengan bobot ringan: bersih, modern, mudah dipakai untuk brand buku.",
    usage: "Judul SemiBold, teks Light — kontras bobot, bukan kontras keluarga font." },

  { id: "parisienne-cormorant",
    heading: { family: "Parisienne", aliases: ["Parisienne", "Bickham Script Pro"], boldPS: ["Parisienne-Regular", "BickhamScriptPro-Regular", "SegoeScript"],
      css: 'Parisienne,"Bickham Script Pro","Segoe Script","Brush Script MT",cursive', case: "none", tracking: 10 },
    body: { family: "Cormorant Garamond", aliases: ["Cormorant Garamond", "Cormorant", "EB Garamond", "Garamond"], regularPS: ["CormorantGaramond-Regular", "CormorantGaramond-Light", "EBGaramond-Regular", "Garamond", "AGaramondPro-Regular"],
      css: '"Cormorant Garamond","EB Garamond",Garamond,Georgia,serif', tracking: 40 },
    genres: ["romansa", "puisi"],
    feels: ["romantis", "nostalgik", "elegan"],
    why: "Skrip tipis sebagai judul + Garamond ber-tracking lega: sangat personal, seperti undangan.",
    usage: "Skrip jangan dipakai untuk teks panjang atau di bawah 24 pt — tidak terbaca." }
];

/* ============================ 2. WARNA ============================ */

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function normHex(v) {
  if (!v) return null;
  var h = String(v).trim().replace(/[^0-9a-fA-F#]/g, "");
  if (h.charAt(0) === "#") h = h.slice(1);
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  if (h.length !== 6) return null;
  return "#" + h.toUpperCase();
}

function hexToRgb(hex) {
  var h = normHex(hex) || "#000000";
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16)
  };
}

function rgbToHex(r, g, b) {
  function t(v) {
    var s = clamp(Math.round(v), 0, 255).toString(16).toUpperCase();
    return s.length === 1 ? "0" + s : s;
  }
  return "#" + t(r) + t(g) + t(b);
}

function srgbToLinear(v) {
  var c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v) {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function rgbToOklab(r, g, b) {
  var lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  var l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  var m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  var s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  };
}

function oklabToLinear(L, a, b) {
  var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ];
}

function oklchToHex(L, C, H) {
  var rad = H * Math.PI / 180;
  var lo = 0, hi = Math.max(0, C);
  var best = "#000000";
  for (var i = 0; i < 20; i++) {
    var mid = (lo + hi) / 2;
    var lin = oklabToLinear(L, mid * Math.cos(rad), mid * Math.sin(rad));
    var inGamut = lin[0] >= 0 && lin[0] <= 1 && lin[1] >= 0 && lin[1] <= 1 && lin[2] >= 0 && lin[2] <= 1;
    if (inGamut) {
      best = rgbToHex(linearToSrgb(lin[0]) * 255, linearToSrgb(lin[1]) * 255, linearToSrgb(lin[2]) * 255);
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

function hexToOklch(hex) {
  var c = hexToRgb(hex);
  var lab = rgbToOklab(c.r, c.g, c.b);
  var C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  var H = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L, C: C, H: H };
}

function relLum(hex) {
  var c = hexToRgb(hex);
  return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
}

function contrastRatio(a, b) {
  var l1 = relLum(a), l2 = relLum(b);
  var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function gradeOf(ratio, large) {
  if (ratio >= 7) return { text: "AAA", cls: "" };
  if (ratio >= 4.5) return { text: "AA", cls: "" };
  if (large && ratio >= 3) return { text: "AA besar", cls: "mid" };
  if (ratio >= 3) return { text: "cukup", cls: "mid" };
  return { text: "kurang", cls: "low" };
}

function fmtRatio(r) {
  return (Math.round(r * 10) / 10).toFixed(1) + ":1";
}

function adjustForContrast(hex, bg, target) {
  if (contrastRatio(hex, bg) >= target) return hex;
  var o = hexToOklch(hex);
  var best = hex, bestRatio = contrastRatio(hex, bg);
  for (var i = 1; i <= 24; i++) {
    var deltas = [i * 0.022, -i * 0.022];
    for (var d = 0; d < 2; d++) {
      var L = o.L + deltas[d];
      if (L < 0.05 || L > 0.99) continue;
      var cand = oklchToHex(L, o.C, o.H);
      var r = contrastRatio(cand, bg);
      if (r > bestRatio) { bestRatio = r; best = cand; }
    }
    if (bestRatio >= target) break;
  }
  return best;
}

function hueNameOf(h) {
  var names = [[20, "Merah"], [45, "Jingga"], [68, "Emas"], [100, "Zaitun"], [160, "Zamrud"], [195, "Toska"], [230, "Langit"], [265, "Nila"], [300, "Ungu"], [338, "Magenta"], [361, "Rose"]];
  for (var i = 0; i < names.length; i++) {
    if (h < names[i][0]) return names[i][1];
  }
  return "Rose";
}

function generatePalette(baseHex, scheme, tone) {
  var inHex = normHex(baseHex) || "#A6392E";
  var base = hexToOklch(inHex);
  var dark = tone !== "light";
  /* Abu / hitam / putih: hue hasil atan2(0,0) cuma noise float. Arah hangat dipilih
     supaya warna netral yang dimasukkan user tidak berubah jadi hue acak. */
  var neutral = base.C < 0.012;
  var H = neutral ? (dark ? 60 : 38) : base.H;
  var hues = (SCHEMES[scheme] || SCHEMES.analogous).fn(H);
  var seed = Math.round(H * 7 + (dark ? 13 : 29)) % 6;

  var baseL = dark ? 0.165 + seed * 0.006 : 0.955 - seed * 0.004;
  var surfL = dark ? 0.245 + seed * 0.008 : 0.900 - seed * 0.006;
  var accL = dark ? 0.680 : 0.560;
  var accC = neutral ? 0.105 : Math.min(0.20, Math.max(0.09, base.C * 1.35));

  var baseColor = oklchToHex(baseL, neutral ? (dark ? 0.010 : 0.005) : (dark ? 0.030 : 0.014), H);
  var accent = oklchToHex(accL, accC, hues[0]);
  /* Judul sering = aksen: dorong sampai 4,5:1 (aman untuk huruf kecil), minimal 3:1. */
  if (contrastRatio(accent, baseColor) < 4.5) accent = adjustForContrast(accent, baseColor, 4.5);
  if (contrastRatio(accent, baseColor) < 3) accent = adjustForContrast(accent, baseColor, 3);

  var surface = oklchToHex(surfL, neutral ? (dark ? 0.014 : 0.009) : (dark ? 0.038 : 0.026), H);
  var ink = oklchToHex(dark ? 0.965 : 0.205, dark ? 0.010 : 0.018, H);
  var muted = oklchToHex(dark ? 0.640 : 0.545, 0.018, H);
  if (contrastRatio(muted, baseColor) < 3) muted = adjustForContrast(muted, baseColor, 3);

  return {
    id: "gen-" + Date.now(),
    name: (dark ? ["Malam", "Senja", "Arang", "Tinta", "Bayang", "Kabus"] : ["Kertas", "Kapas", "Embun", "Fajar", "Pasir", "Salju"])[seed] + " " + hueNameOf(hues[0]),
    genres: [state.genre],
    feels: state.feel ? [state.feel] : [],
    colors: { base: baseColor, surface: surface, accent: accent, ink: ink, muted: muted },
    note: neutral
      ? "Dasarnya netral (" + inHex + "), jadi plugin memilih arah " + (dark ? "hangat gelap" : "kertas terang") + " sendiri; aksen digeser sampai kontras aman."
      : "Dibuat dari " + inHex + " dengan harmoni " + (SCHEMES[scheme] || SCHEMES.analogous).label.toLowerCase() + ", nada " + (dark ? "gelap" : "terang") + "."
  };
}

/* Nama palet bisa bentrok (banyak hue menghasilkan nama sama). */
function uniqueName(name, list) {
  var taken = {};
  (list || []).concat(PALETTES).forEach(function (p) { taken[p.name] = 1; });
  if (!taken[name]) return name;
  var base = name;
  for (var i = 2; i < 40; i++) {
    name = base + " " + i;
    if (!taken[name]) return name;
  }
  return base + " " + Date.now();
}


/* Ekstraksi warna: kelompokkan sampel piksel jadi 5 peran palet.
   Murni dan deterministik supaya bisa diuji tanpa Photoshop. */
function paletteFromSamples(hexes) {
  var list = (hexes || []).map(normHex).filter(Boolean);
  if (!list.length) return null;

  /* Kuantisasi 8 level per kanal supaya gradasi lembut tidak pecah jadi 100 warna. */
  var buckets = {};
  list.forEach(function (h) {
    var c = hexToRgb(h);
    var key = (c.r >> 5) + "-" + (c.g >> 5) + "-" + (c.b >> 5);
    if (!buckets[key]) buckets[key] = { n: 0, r: 0, g: 0, b: 0 };
    var b = buckets[key];
    b.n++; b.r += c.r; b.g += c.g; b.b += c.b;
  });
  var uniq = [];
  Object.keys(buckets).map(function (k) {
    var b = buckets[k];
    return { n: b.n, hex: rgbToHex(Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)) };
  }).sort(function (a, b) { return b.n - a.n; }).forEach(function (o) {
    if (!uniq.some(function (u) { return u.hex === o.hex; })) uniq.push(o);
  });
  if (!uniq.length) return null;

  function sat(hex) {
    var c = hexToRgb(hex);
    var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    return mx ? (mx - mn) / mx : 0;
  }

  var base = uniq[0].hex;
  var surface = (uniq[1] && uniq[1].hex) || base;

  /* Aksen: paling jenuh yang cukup berbeda dari latar. */
  var accent = base, best = -1;
  uniq.forEach(function (u) {
    var score = sat(u.hex) * (1 + contrastRatio(u.hex, base));
    if (u.hex !== base && score > best) { best = score; accent = u.hex; }
  });

  /* Tinta: warna paling gelap, dipaksa memenuhi 4,5:1 di atas latar. */
  var ink = null, inkL = 2;
  uniq.forEach(function (u) { if (relLum(u.hex) < inkL) { inkL = relLum(u.hex); ink = u.hex; } });
  ink = adjustForContrast(ink || "#101010", base, 4.5);

  /* Redup: yang paling jauh dari jenuh/ringan, untuk subjudul & keterangan. */
  var muted = null, mScore = -Infinity;
  uniq.forEach(function (u) {
    if (u.hex === ink || u.hex === accent) return;
    var sc = -Math.abs(sat(u.hex) - 0.18) - Math.abs(relLum(u.hex) - 0.35);
    if (sc > mScore) { mScore = sc; muted = u.hex; }
  });
  if (!muted) muted = adjustForContrast(ink, base, 3);

  return {
    colors: { base: base, surface: surface, accent: accent, ink: ink, muted: muted },
    top: uniq.slice(0, 6).map(function (u) { return u.hex + " x" + u.n; }),
    n: list.length
  };
}

/* ============================ 3. STATE ============================ */

const STORE_KEY = "sampul.state.v1";
const MAX_CUSTOM = 24;

const state = {
  genre: "sastra",
  feel: null,
  paletteId: null,
  custom: [],
  pairingId: null,
  override: { heading: null, body: null },
  cover: { title: "JUDUL BUKU", subtitle: "", author: "NAMA PENULIS", preset: "6x9", fill: true },
  wrap: { format: "kdp", paper: "putih", pages: 180, bleed: "in125", spine: true, publisher: "", blurb: "", isbn: "" },
  fonts: { ok: false, list: [], byFamily: {}, error: null, loaded: false },
  genHex: "#A6392E",
  genScheme: "analogous",
  genTone: "dark",
  fontPick: null,
  fontQuery: "",
  logLines: []
};

/* ---- palet simpanan: validasi, tanda tangan warna, dan pembersihan ---- */

function isCustomPalette(p) {
  if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !p.colors) return false;
  return ROLES.every(function (r) { return !!normHex(p.colors[r.key]); });
}

function sigOf(p) {
  var c = (p && p.colors) || {};
  return ROLES.map(function (r) { return normHex(c[r.key]) || "?"; }).join("|");
}

function cleanCustom(p) {
  var out = {};
  ROLES.forEach(function (r) { out[r.key] = normHex(p.colors[r.key]); });
  return {
    id: p.id,
    name: String(p.name).slice(0, 60),
    genres: Array.isArray(p.genres) ? p.genres.slice(0, 10) : [],
    feels: Array.isArray(p.feels) ? p.feels.slice(0, 10) : [],
    colors: out,
    note: typeof p.note === "string" ? p.note.slice(0, 400) : "Palet simpanan."
  };
}

/* Buang entri rusak, duplikat, dan salinan persis palet kurasi (bug lama v1.2). */
function pruneCustom(list) {
  var seen = {};
  PALETTES.forEach(function (p) { seen[sigOf(p)] = 1; });
  var out = [];
  (Array.isArray(list) ? list : []).forEach(function (p) {
    if (!isCustomPalette(p)) return;
    var s = sigOf(p);
    if (seen[s]) return;
    seen[s] = 1;
    out.push(cleanCustom(p));
  });
  return out.slice(0, MAX_CUSTOM);
}

/* Simpan palet baru kalau benar-benar baru; kembalikan palet yang tersimpan atau null. */
function pushCustom(p) {
  if (!isCustomPalette(p)) return null;
  var sig = sigOf(p);
  var ada = state.custom.some(function (q) { return sigOf(q) === sig; });
  PALETTES.some(function (q) { if (sigOf(q) === sig) ada = true; });
  if (ada) return null;
  p.name = uniqueName(p.name, state.custom);
  state.custom = pruneCustom([p].concat(state.custom));
  return findById(state.custom, p.id);
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      genre: state.genre,
      feel: state.feel,
      paletteId: state.paletteId,
      custom: state.custom,
      pairingId: state.pairingId,
      override: state.override,
      genScheme: state.genScheme,
      genTone: state.genTone,
      wrap: state.wrap,
      cover: state.cover
    }));
  } catch (e) { /* penyimpanan tidak tersedia — abaikan */ }
}

function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
  if (!raw) return;
  try {
    var d = JSON.parse(raw);
    if (d.genre && findById(GENRES, d.genre)) state.genre = d.genre;
    if (d.feel === null || findById(FEELS, d.feel)) state.feel = d.feel || null;
    if (d.paletteId) state.paletteId = d.paletteId;
    if (d.custom && d.custom.length) state.custom = pruneCustom(d.custom);
    if (d.pairingId && findById(PAIRINGS, d.pairingId)) state.pairingId = d.pairingId;
    if (d.override) {
      ["heading", "body"].forEach(function (k) {
        var o = d.override[k];
        if (o && typeof o.ps === "string" && typeof o.family === "string") {
          state.override[k] = { family: o.family, ps: o.ps, style: typeof o.style === "string" ? o.style : "" };
        }
      });
    }
    if (d.genScheme && SCHEMES[d.genScheme]) state.genScheme = d.genScheme;
    if (d.genTone === "dark" || d.genTone === "light") state.genTone = d.genTone;
    if (d.cover) {
      ["title", "subtitle", "author", "preset"].forEach(function (k) {
        if (typeof d.cover[k] === "string") state.cover[k] = d.cover[k];
      });
      if (typeof d.cover.fill === "boolean") state.cover.fill = d.cover.fill;
    }
    if (d.wrap) applyWrap(d.wrap);
  } catch (e) { /* data lama rusak — mulai bersih */ }
}

/* Sanitisasi konfigurasi liput penuh: nilai aneh tidak boleh meruntuhkan geometri. */
function applyWrap(d) {
  var w = state.wrap;
  if (d.format && WRAP_FORMATS[d.format]) w.format = d.format;
  if (d.paper && PAPERS[d.paper]) w.paper = d.paper;
  if (d.bleed && BLEEDS[d.bleed]) w.bleed = d.bleed;
  if (typeof d.spine === "boolean") w.spine = d.spine;
  var p = Number(d.pages);
  if (!isNaN(p)) w.pages = clamp(Math.round(p), 0, 3000);
  ["publisher", "blurb", "isbn"].forEach(function (k) {
    if (typeof d[k] === "string") w[k] = d[k].slice(0, 600);
  });
}

/* ---- proyek .sampul.json: satu berkas, semua isi kerja ---- */

function serializeProject() {
  var g = wrapGeom();
  return JSON.stringify({
    kind: "sampul.project",
    appVersion: APP_VERSION,
    saved: new Date().toISOString(),
    state: {
      genre: state.genre, feel: state.feel, paletteId: state.paletteId, custom: state.custom,
      pairingId: state.pairingId, override: state.override, genHex: state.genHex,
      genScheme: state.genScheme, genTone: state.genTone, cover: state.cover, wrap: state.wrap
    },
    computed: {
      palette: currentPalette(),
      pairing: { id: currentPairing().id, name: currentPairing().name },
      wrapGeom: { totalW: g.totalW, totalH: g.totalH, spineMm: Number(g.spineMm.toFixed(3)), dpi: g.dpi, warnings: g.warnings }
    }
  }, null, 2);
}

function applyProject(raw) {
  var d = null;
  try { d = JSON.parse(String(raw)); } catch (e) { return "Berkas bukan JSON yang sah."; }
  if (!d || d.kind !== "sampul.project" || !d.state) return "Berkas bukan proyek Sampul (kind != sampul.project).";
  var s = d.state;
  if (s.genre && findById(GENRES, s.genre)) state.genre = s.genre;
  if (s.feel === null || findById(FEELS, s.feel)) state.feel = s.feel || null;
  if (s.paletteId) state.paletteId = s.paletteId;
  state.custom = pruneCustom(Array.isArray(s.custom) ? s.custom : []);
  if (s.pairingId && findById(PAIRINGS, s.pairingId)) state.pairingId = s.pairingId;
  if (s.override) ["heading", "body"].forEach(function (k) {
    var o = s.override[k];
    state.override[k] = (o && typeof o.ps === "string") ? { family: o.family, ps: o.ps, style: o.style || "" } : null;
  });
  if (typeof s.genHex === "string" && normHex(s.genHex)) state.genHex = normHex(s.genHex);
  if (s.genScheme && SCHEMES[s.genScheme]) state.genScheme = s.genScheme;
  if (s.genTone === "dark" || s.genTone === "light") state.genTone = s.genTone;
  if (s.cover) ["title", "subtitle", "author", "preset"].forEach(function (k) {
    if (typeof s.cover[k] === "string" && (k !== "preset" || PRESETS[s.cover[k]])) state.cover[k] = s.cover[k];
  });
  if (typeof s.cover.fill === "boolean") state.cover.fill = s.cover.fill;
  if (s.wrap) applyWrap(s.wrap);
  saveState();
  renderAll();
  return null;
}

/* ============================ 4. PHOTOSHOP ============================ */

var PS = (function () {
  var ps = null, uxpMod = null;
  try { ps = require("photoshop"); } catch (e) { ps = null; }
  try { uxpMod = require("uxp"); } catch (e) { uxpMod = null; }
  var live = !!(ps && ps.app && ps.core && ps.action);

  function bp(descriptors) {
    return ps.action.batchPlay(descriptors, {});
  }

  function run(commandName, fn) {
    if (!live) {
      log("[demo] " + commandName + " — Photoshop tidak terdeteksi.");
      return Promise.resolve(null);
    }
    return ps.core.executeAsModal(fn, { commandName: commandName });
  }

  function rgbDesc(hex) {
    var c = hexToRgb(hex);
    return { _obj: "RGBColor", red: c.r, green: c.g, blue: c.b };
  }

  function px(v) { return { _obj: "pixelsUnit", _unit: "pixelsUnit", _value: v }; }
  function pt(v) { return { _obj: "pointsUnit", _unit: "pointsUnit", _value: v }; }

  function numOf(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") { var f = parseFloat(v); return isNaN(f) ? 0 : f; }
    if (typeof v.value === "number") return v.value;
    if (typeof v._value === "number") return v._value;
    var g = parseFloat(String(v));
    return isNaN(g) ? 0 : g;
  }

  /* UnitDouble dari batchPlay: { _unit: "inchesUnit", _value: 6 }. Konversi eksplisit ke
     piksel — v1.2 menebak "di bawah 200 dianggap inci" yang salah untuk dokumen kecil. */
  function unitOf(v) { return (v && typeof v === "object" && v._unit) ? v._unit : "pixelsUnit"; }

  function toPixels(v, dpi) {
    var n = numOf(v && typeof v === "object" ? v._value : v);
    var u = unitOf(v);
    if (!dpi) dpi = 300;
    if (u === "inchesUnit") return n * dpi;
    if (u === "centimetersUnit") return n * dpi / 2.54;
    if (u === "millimetersUnit") return n * dpi / 25.4;
    if (u === "pointsUnit") return n * dpi / 72;
    if (u === "picasUnit") return n * dpi / 6;
    return n;
  }

  /* Ukuran dokumen dibaca lewat AM supaya satuannya tidak hilang; fallback ke API inti. */
  function measureDoc(doc, preset) {
    var fallback = function () {
      var dpi = (doc ? numOf(doc.resolution) : 0) || (preset ? preset.dpi : 300);
      var w = doc ? toPixels(doc.width, dpi) : 0;
      var h = doc ? toPixels(doc.height, dpi) : 0;
      if (!w || !h) { w = preset ? preset.w : 1800; h = preset ? preset.h : 2700; }
      return { w: w, h: h, dpi: dpi, src: "core" };
    };
    if (!live) return Promise.resolve(fallback());
    return bp([{
      _obj: "get",
      _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
      _props: ["width", "height", "resolution"]
    }]).then(function (res) {
      var d = res && res[0];
      if (!d || !d.width || !d.height) return fallback();
      var dpi = numOf(d.resolution) || (preset ? preset.dpi : 300);
      var w = toPixels(d.width, dpi), h = toPixels(d.height, dpi);
      if (!w || !h) return fallback();
      return { w: w, h: h, dpi: dpi, src: "action" };
    }, function () { return fallback(); });
  }

  var lastCreatePath = null, lastTextPath = null;

  function docDesc(preset, name, full) {
    var using = {
      _obj: "document",
      name: name,
      width: px(preset.w),
      height: px(preset.h),
      resolution: { _obj: "densityUnit", _unit: "densityUnit", _value: preset.dpi }
    };
    if (full) {
      /* Bentuk enum/kelas ditiru dari kode internal Photoshop (Required\UXP):
         fill pakai _enum, mode pakai _class. v1.2 memakai bentuk _obj untuk
         "white" dan "RGBColorMode" yang tidak dikenal. Bit depth dan profil
         sengaja tidak dipaksa: default sudah 8-bit + ruang kerja RGB. */
      using.mode = { _class: "RGBColorMode" };
      using.fill = { _enum: "fill", _value: "white" };
    }
    return { _obj: "make", _target: [{ _ref: "document" }], using: using };
  }

  /* Tiga jalur berurutan: API inti (terdokumentasi) -> batchPlay lengkap -> batchPlay minimal. */
  function createDocument(preset, name) {
    var docs = (ps && ps.app && ps.app.documents) ? ps.app.documents : null;
    var viaCore = function () {
      if (!docs || typeof docs.add !== "function") return Promise.reject(new Error("documents.add tidak tersedia."));
      return Promise.resolve(docs.add({
        width: preset.w,
        height: preset.h,
        resolution: preset.dpi,
        mode: "rgb",
        fill: "white",
        name: name
      })).then(function (doc) { return doc || ps.app.activeDocument; });
    };
    var viaBP = function (full) {
      return bp([docDesc(preset, name, full)]).then(function () {
        var doc = ps.app.activeDocument;
        if (!doc) throw new Error("Dokumen baru tidak terbuka.");
        return doc;
      });
    };
    return viaCore().then(function (doc) { lastCreatePath = "core"; return doc; }, function () {
      return viaBP(true).then(function (doc) { lastCreatePath = "action-full"; return doc; }, function () {
        return viaBP(false).then(function (doc) { lastCreatePath = "action-min"; return doc; });
      });
    });
  }

  function fillBackground(hex) {
    return bp([{
      _obj: "make",
      _target: [{ _ref: "contentLayer" }],
      using: {
        _obj: "contentLayer",
        name: "Latar",
        type: { _obj: "solidColorLayer", color: rgbDesc(hex) }
      }
    }]).then(function () {
      return bp([{
        _obj: "move",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        to: { _ref: "layer", _enum: "ordinal", _value: "back" }
      }]);
    });
  }

  function activeBounds() {
    return bp([{
      _obj: "get",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _property: "bounds"
    }]).then(function (res) {
      var b = res && res[0] && res[0].bounds;
      if (!b) return null;
      return { left: numOf(b.left), top: numOf(b.top), right: numOf(b.right), bottom: numOf(b.bottom) };
    });
  }

  function translate(dx, dy) {
    return bp([{
      _obj: "move",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      to: { _obj: "offset", horizontal: px(dx), vertical: px(dy) }
    }]);
  }

  function centerActiveAt(x, y) {
    return activeBounds().then(function (b) {
      if (!b) return null;
      var cx = (b.left + b.right) / 2;
      var cy = (b.top + b.bottom) / 2;
      var dx = x - cx, dy = y - cy;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
      return translate(dx, dy);
    });
  }

  function textLayerDesc(o, full) {
    var text = o.textCase === "upper" ? o.text.toUpperCase() : o.text;
    var textStyle = {
      _obj: "textStyle",
      fontPostScriptName: o.font,
      size: pt(Math.round(o.size * 100) / 100),
      color: rgbDesc(o.color),
      tracking: Math.round(o.tracking || 0)
    };
    if (full) {
      /* v1.2 menaruh kunci "autoKerning" (boolean) — kunci AM yang benar adalah
         "autoKern" bertipe enum, jadi pengaturan itu tidak pernah masuk ke layer. */
      textStyle.autoKern = { _enum: "autoKern", _value: "metricsKern" };
      textStyle.horizontalScale = 100;
      textStyle.verticalScale = 100;
      if (o.leadingFactor) {
        textStyle.autoLeading = false;
        textStyle.leading = pt(Math.round(o.size * o.leadingFactor * 100) / 100);
      } else {
        textStyle.autoLeading = true;
      }
    }
    var using = {
      _obj: "textLayer",
      name: o.name,
      textKey: text,
      textStyleRange: [{
        _obj: "textStyleRange",
        from: 0,
        to: text.length,
        textStyle: textStyle
      }]
    };
    if (full) {
      using.paragraphStyleRange = [{
        _obj: "paragraphStyleRange",
        from: 0,
        to: text.length,
        paragraphStyle: {
          _obj: "paragraphStyle",
          justification: { _enum: "alignmentType", _value: o.justify || "center" }
        }
      }];
    }
    return { _obj: "make", _target: [{ _ref: "textLayer" }], using: using };
  }

  function makeTextLayer(o) {
    /* Kalau varian lengkap ditolak (enum tidak dikenali versi PS), ulangi tanpa
       hiasan supaya teks tetap terbentuk. */
    return bp([textLayerDesc(o, true)]).then(function () {
      lastTextPath = "full";
      return centerActiveAt(o.cx, o.cy);
    }, function () {
      return bp([textLayerDesc(o, false)]).then(function () {
        lastTextPath = "basic";
        return centerActiveAt(o.cx, o.cy);
      });
    });
  }

  function tintActiveText(hex) {
    return run("Sampul: warnai teks", function () {
      var doc = ps.app.activeDocument;
      if (!doc) throw new Error("Tidak ada dokumen aktif.");
      var layers = doc.activeLayers;
      if (!layers || !layers.length) throw new Error("Pilih satu layer teks dulu.");
      var layer = layers[0];
      var c = hexToRgb(hex);

      try {
        var ti = layer.textItem;
        if (!ti) throw new Error("Layer terpilih bukan teks.");
        var SC = ps.SolidColor;
        if (!SC) throw new Error("SolidColor tidak tersedia.");
        var color = new SC();
        color.rgb.red = c.r;
        color.rgb.green = c.g;
        color.rgb.blue = c.b;
        ti.color = color;
        return;
      } catch (e) {
        return bp([{
          _obj: "set",
          _target: [{ _ref: "textLayer", _enum: "ordinal", _value: "targetEnum" }],
          to: {
            _obj: "textLayer",
            textStyleRange: [{
              _obj: "textStyleRange",
              from: 0,
              to: 10000,
              textStyle: { _obj: "textStyle", color: rgbDesc(hex) }
            }]
          }
        }]);
      }
    });
  }

  /* Putar layer aktif — untuk teks punggung buku. */
  function rotateActive(angle) {
    return bp([{
      _obj: "rotate",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      angle: { _unit: "angleUnit", _value: angle }
    }]).catch(function () {
      return bp([{
        _obj: "rotateEvent",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        angle: { _unit: "angleUnit", _value: angle },
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" }
      }]);
    });
  }

  function loadFonts() {
    var api = live && ps.app ? ps.app.fonts : null;
    if (!api) {
      return Promise.resolve({ ok: false, styleCount: 0, famCount: 0, byFamily: {}, ms: 0, error: "app.fonts tidak tersedia." });
    }
    var getter = null;
    if (typeof api.getFonts === "function") getter = api.getFonts();
    else if (Array.isArray(api.fonts)) getter = api.fonts;
    else return Promise.resolve({ ok: false, styleCount: 0, famCount: 0, byFamily: {}, ms: 0, error: "Daftar font tidak bisa dibaca." });

    return Promise.resolve(getter).then(function (fonts) {
      var t0 = Date.now();
      var styleCount = 0, byFamily = {};
      /* Jangan simpan salinan seluruh font (mesin ini punya >12.000 berkas):
         yang dibutuhkan hanya byFamily + jumlah, bukan list 12.000 objek. */
      (fonts || []).forEach(function (f) {
        var family = f.family || f.familyName || f.name || "";
        var style = f.style || f.styleName || "";
        var psName = f.postScriptName || f.postscriptName || "";
        if (!family || !psName) return;
        var key = normName(family);
        if (!byFamily[key]) byFamily[key] = { family: family, styles: [] };
        byFamily[key].styles.push({
          ps: psName,
          style: style,
          weight: styleWeight(style),
          italic: /italic|oblique/i.test(style)
        });
        styleCount++;
      });
      return {
        ok: styleCount > 0,
        styleCount: styleCount,
        famCount: Object.keys(byFamily).length,
        byFamily: byFamily,
        ms: Date.now() - t0,
        error: styleCount ? null : "Tidak ada font terbaca."
      };
    }).catch(function (err) {
      return { ok: false, styleCount: 0, famCount: 0, byFamily: {}, ms: 0, error: msgOf(err) };
    });
  }

  /* "Uji aksi": cek tiap deskriptor batchPlay satu per satu dan kembalikan hasilnya.
     Hanya membuat dokumen sementara bernama UJI Sampul, lalu menutupnya tanpa menyimpan. */
  function selfTest(preset) {
    var out = [];
    function rec(name, ok, info) { out.push({ name: name, ok: ok, info: String(info || "").slice(0, 140) }); }
    if (!live) {
      rec("Photoshop", false, "mode demo (browser) — buka panel ini di Photoshop");
      return Promise.resolve(out);
    }
    return run("Sampul: uji aksi", function () {
      var doc = ps.app.activeDocument;
      var chain = Promise.resolve();

      chain = chain.then(function () {
        return bp([{ _obj: "get", _target: [{ _ref: "color", _property: "foregroundColor" }] }]).then(function (r) {
          var c = r && r[0] && r[0].foregroundColor;
          rec("Ambil foreground (_ref: color)", !!c, c ? (c.red + "," + c.green + "," + c.blue) : "respons tanpa foregroundColor");
        }, function (e) { rec("Ambil foreground (_ref: color)", false, msgOf(e)); });
      });

      chain = chain.then(function () {
        return bp([{
          _obj: "set",
          _target: [{ _ref: "color", _property: "foregroundColor" }],
          to: rgbDesc("#A6392E")
        }]).then(function () { rec("Set foreground (#A6392E)", true, "diterima"); },
           function (e) { rec("Set foreground (#A6392E)", false, msgOf(e)); });
      });

      if (doc) {
        chain = chain.then(function () {
          return measureDoc(doc, preset).then(function (m) {
            rec("Ukuran dokumen aktif", true, Math.round(m.w) + "x" + Math.round(m.h) + " px @" + Math.round(m.dpi) + " dpi (sumber: " + m.src + ")");
          });
        });
      } else {
        rec("Ukuran dokumen aktif", false, "tidak ada dokumen terbuka");
      }

      chain = chain.then(function () {
        return loadFonts().then(function (f) {
          rec("Daftar font", f.ok, (f.styleCount || 0) + " gaya / " + f.famCount + " keluarga, " + f.ms + " ms" + (f.error ? " — " + f.error : ""));
        });
      });

      chain = chain.then(function () {
        return createDocument({ w: 300, h: 400, dpi: 72 }, "UJI Sampul").then(function () {
          rec("Create document", true, "via " + lastCreatePath);
          return makeTextLayer({
            name: "Uji Teks", text: "UJI", font: "ArialMT", size: 24, color: "#000000",
            tracking: 0, textCase: "none", justify: "center", cx: 150, cy: 200
          }).then(function () { rec("Make text layer + geser", true, "varian " + lastTextPath); },
             function (e) { rec("Make text layer + geser", false, msgOf(e)); });
        }, function (e) {
          rec("Create document", false, msgOf(e));
        }).then(function () {
          return bp([{
            _obj: "close",
            _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
            saving: { _enum: "yesNo", _value: "no" }
          }]).then(function () { rec("Tutup dokumen uji", true, "tanpa menyimpan"); },
             function (e) { rec("Tutup dokumen uji", false, msgOf(e) + " — tutup manual 'UJI Sampul'"); });
        });
      });

      return chain.then(function () { return out; }, function () { return out; });
    }).then(function (r) { return r || out; }, function (e) {
      rec("executeAsModal", false, msgOf(e));
      return out;
    });
  }

  /* ---------- ekstraksi warna dari dokumen aktif ---------- */
  /* photoshop 28.2 membatasi 10 colorSampler per dokumen (terukur: yang ke-11
     ditolak), jadi grid dipecah jadi beberapa ronde: bersihkan -> buat -> baca. */
  var SAMPLER_MAX = 10;

  function samplerMakeDesc(x, y) {
    return {
      _obj: "make",
      _target: [{ _ref: "colorSampler" }],
      position: {
        _obj: "paint",
        horizontal: px(Math.round(x)),
        vertical: px(Math.round(y))
      }
    };
  }

  function samplerClearDesc() {
    return { _obj: "delete", _target: { _ref: [{ _ref: "colorSampler", _enum: "ordinal", _value: "allEnum" }] } };
  }

  function clearSamplers() {
    return bp([samplerClearDesc()]).catch(function () {
      return bp([{ _obj: "delete", _target: [{ _ref: "colorSampler", _enum: "ordinal", _value: "allEnum" }] }]);
    });
  }

  /* Entri colorSamplerList: { position:{horizontal,vertical}, color:{red,green,blue} }.
     Nama kunci bisa berbeda antar versi, jadi dicari angka RGB di dalam mana pun. */
  function entryHex(e) {
    if (!e || typeof e !== "object") return null;
    var c = e.color || e.RGBColor || null;
    if (!c) return null;
    function g(names) {
      for (var i = 0; i < names.length; i++) {
        var v = c[names[i]];
        if (typeof v === "number") return v;
        if (v && typeof v._value === "number") return v._value;
      }
      return null;
    }
    var r = g(["red", "Rd  "]), gg = g(["green", "Grn "]), b = g(["blue", "Bl  "]);
    if (r === null || gg === null || b === null) return null;
    var s = function (n) { return clamp(Math.round(n), 0, 255); };
    return rgbToHex(s(r), s(gg), s(b));
  }

  function readSamplerColors() {
    return bp([{
      _obj: "get",
      _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
      _props: ["colorSamplerList"]
    }]).then(function (res) {
      var d = res && res[0];
      var list = d && d.colorSamplerList;
      if (!Array.isArray(list)) return [];
      return list.map(entryHex).filter(function (h) { return !!h; });
    });
  }

  /* Titik kisi berstrata: tidak tepat di tengah (subjek foto) dan tidak di tepi. */
  function gridPoints(w, h) {
    var fx = [0.16, 0.38, 0.62, 0.84];
    var fy = [0.12, 0.30, 0.50, 0.70, 0.88];
    var pts = [];
    for (var j = 0; j < fy.length; j++) {
      for (var i = 0; i < fx.length; i++) {
        pts.push({ x: clamp(Math.round(w * fx[i]), 0, w - 1), y: clamp(Math.round(h * fy[j]), 0, h - 1) });
      }
    }
    return pts;
  }

  function sampleActive(docSize) {
    var w = Math.round(docSize.w), h = Math.round(docSize.h);
    if (!w || !h) return Promise.reject(new Error("Ukuran dokumen tidak terbaca."));
    var pts = gridPoints(w, h);
    var rounds = [];
    for (var i = 0; i < pts.length; i += SAMPLER_MAX) rounds.push(pts.slice(i, i + SAMPLER_MAX));
    var colors = [];
    var chain = Promise.resolve();
    rounds.forEach(function (batch, ri) {
      chain = chain.then(function () { return clearSamplers(); })
        .then(function () { return bp(batch.map(function (p) { return samplerMakeDesc(p.x, p.y); })); })
        .then(function () { return readSamplerColors(); })
        .then(function (got) {
          colors = colors.concat(got);
        }, function (e) {
          log("Ronde sampler " + (ri + 1) + " gagal: " + msgOf(e));
        });
    });
    return chain.then(function () { return clearSamplers().catch(function () {}); }).then(function () {
      return { colors: colors, points: pts.length, rounds: rounds.length };
    });
  }

  /* ---------- garis panduan trim/bleed ---------- */
  function guideDesc(orientation, position) {
    return {
      _obj: "newGuide",
      _target: [{ _ref: "guide" }],
      new: { orientation: { _enum: "orientation", _value: orientation }, position: px(position) }
    };
  }

  function addGuides(lines) {
    return bp(lines.map(function (l) { return guideDesc(l.o, l.p); })).catch(function () {
      return bp(lines.map(function (l) {
        var d = { _obj: "newGuide", _target: { _ref: "guide" }, new: {} };
        d.new.orientation = { _enum: "orientation", _value: l.o };
        d.new.position = { _unit: "pixelsUnit", _value: l.p };
        return d;
      }));
    });
  }

  /* ---------- ekspor: file token lalu saveAs inti, fallback AM ---------- */
  var SAVE_TYPES = {
    png: ["png"], jpg: ["jpg", "jpeg"], psd: ["psd"], psb: ["psb"], gif: ["gif"], bmp: ["bmp"], pdf: ["pdf"], json: ["json"]
  };
  var AM_SAVE = {
    png: function () { return { cls: "PNGFormat", opts: { bitDepth: 8, embedColors: true, interlace: false } }; },
    jpg: function () { return { cls: "JPEGFormat", opts: { quality: 12, embedProfile: true } }; }
  };

  function pickSave(suggestedName, fmt) {
    var lfs = uxpMod && uxpMod.storage ? uxpMod.storage.localFileSystem : null;
    if (!lfs || typeof lfs.getFileForSaving !== "function") {
      return Promise.reject(new Error("Pemilih file tidak tersedia (butuh izin localFileSystem)."));
    }
    var types = (SAVE_TYPES[fmt] || [fmt]).map(function (ext) {
      return { description: ext.toUpperCase(), extension: ext };
    });
    return Promise.resolve(lfs.getFileForSaving(suggestedName, { types: types }));
  }

  function pickOpen(fmt) {
    var lfs = uxpMod && uxpMod.storage ? uxpMod.storage.localFileSystem : null;
    if (!lfs || typeof lfs.getFileForOpening !== "function") {
      return Promise.reject(new Error("Pemilih file tidak tersedia (butuh izin localFileSystem)."));
    }
    var types = (SAVE_TYPES[fmt] || [fmt]).map(function (ext) {
      return { description: ext.toUpperCase(), extension: ext };
    });
    return Promise.resolve(lfs.getFileForOpening({ types: types, allowMultiple: false }));
  }

  function docSaveAs(fmt, entry) {
    var doc = ps.app.activeDocument;
    if (!doc) return Promise.reject(new Error("Tidak ada dokumen aktif."));
    var via = null;
    if (doc.saveAs && typeof doc.saveAs[fmt] === "function") {
      var opts = fmt === "jpg" ? { quality: 12 } : undefined;
      var res = fmt === "jpg" ? doc.saveAs[fmt](entry, opts, true) : doc.saveAs[fmt](entry, opts);
      return Promise.resolve(res).then(function () { return "core:saveAs." + fmt; });
    }
    var mk = AM_SAVE[fmt];
    if (mk) {
      var spec = mk();
      var desc = { _obj: "save", documentID: doc.id, _target: [{ _ref: "document", _id: doc.id }] };
      desc.in = { _kind: "local", _path: entry };
      var o = {};
      for (var k in spec.opts) o[k] = spec.opts[k];
      desc.as = Object.assign({ _obj: spec.cls }, o);
      desc.copy = true;
      return bp([desc]).then(function () { return "action:" + spec.cls; });
    }
    if (fmt === "pdf") {
      /* save-as-PDF lewat AM ditolak build ini; satu-satunya jalan adalah dialog bawaan. */
      return bp([{ _obj: "save", _target: [{ _ref: "document", _id: doc.id }] }], { dialogOptions: "display" })
        .then(function () { return "dialog-save"; });
    }
    return Promise.reject(new Error("Host ini tidak punya saveAs." + fmt + " dan tidak ada jalur cadangan."));
  }

  function saveFormat(fmt, suggestedName) {
    if (!live) return Promise.reject(new Error("Photoshop tidak terdeteksi."));
    /* Pemilih file harus di LUAR executeAsModal; aksi dokumen di dalamnya. */
    return pickSave(suggestedName, fmt).then(function (entry) {
      if (!entry) return { ok: false, cancelled: true };
      return run("Sampul: simpan " + fmt.toUpperCase(), function () {
        return docSaveAs(fmt, entry);
      }).then(function (via) {
        return { ok: true, via: via, name: entry.name || suggestedName };
      });
    });
  }

  /* Thumbnail: duplikat -> ubah ukuran -> simpan PNG -> tutup tanpa simpan. */
  function saveThumb(suggestedName, maxSide) {
    if (!live) return Promise.reject(new Error("Photoshop tidak terdeteksi."));
    if (!ps.app.activeDocument) return Promise.reject(new Error("Tidak ada dokumen aktif."));
    return pickSave(suggestedName, "png").then(function (entry) {
      if (!entry) return { ok: false, cancelled: true };
      var dup = null;
      return run("Sampul: thumbnail", function () {
        return bp([{
          _obj: "duplicate",
          _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
          name: "thumbnail"
        }]).then(function () {
          dup = ps.app.activeDocument;
          return bp([{
            _obj: "imageSize",
            width: { _unit: "pixelsUnit", _value: maxSide },
            height: { _unit: "pixelsUnit", _value: maxSide },
            constrainProportions: true,
            resolution: { _unit: "densityUnit", _value: 72 },
            interpolation: { _enum: "interpolation", _value: "bicubic" }
          }]);
        }).then(function () {
          return docSaveAs("png", entry).then(function (via) {
            return bp([{
              _obj: "close",
              _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
              saving: { _enum: "yesNo", _value: "no" }
            }]).then(function () { return via; });
          });
        }).catch(function (e) {
          if (dup) {
            return bp([{
              _obj: "close",
              _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
              saving: { _enum: "yesNo", _value: "no" }
            }]).then(function () { throw e; }, function () { throw e; });
          }
          throw e;
        });
      }).then(function (via) {
        return { ok: true, via: via, name: entry.name || suggestedName };
      });
    });
  }

  /* ---------- berkas proyek teks ---------- */
  function writeText(entry, text) {
    if (typeof entry.write !== "function") return Promise.reject(new Error("Berkas tidak bisa ditulis."));
    return Promise.resolve(entry.write(text, { format: "utf8" })).then(function () {
      return { ok: true, name: entry.name || "berkas" };
    });
  }

  function readText(entry) {
    if (typeof entry.read !== "function") return Promise.reject(new Error("Berkas tidak bisa dibaca."));
    return Promise.resolve(entry.read({ format: "utf8" })).then(function (t) { return String(t); });
  }

  function saveProject(text, suggestedName) {
    return pickSave(suggestedName, "json").then(function (entry) {
      if (!entry) return { ok: false, cancelled: true };
      return writeText(entry, text);
    });
  }

  function openProject() {
    return pickOpen("json").then(function (entry) {
      if (!entry) return null;
      return readText(entry).then(function (t) { return { text: t, name: entry.name || "proyek" }; });
    });
  }

  function capabilities() {
    var doc = live ? ps.app.activeDocument : null;
    var fmts = ["jpg", "png", "psd", "psb", "gif", "bmp", "pdf"];
    var core = fmts.filter(function (f) { return !!(doc && doc.saveAs && typeof doc.saveAs[f] === "function"); });
    return {
      lfs: !!(uxpMod && uxpMod.storage && uxpMod.storage.localFileSystem && uxpMod.storage.localFileSystem.getFileForSaving),
      coreSaveAs: core,
      amFallback: Object.keys(AM_SAVE),
      doc: doc ? doc.name : null
    };
  }

  return {
    live: live,
    mod: ps,
    uxp: uxpMod,
    bp: bp,
    run: run,
    setColor: function (hex, kind) {
      return run("Sampul: set warna", function () {
        return bp([{
          _obj: "set",
          _target: [{ _ref: "color", _property: kind === "bg" ? "backgroundColor" : "foregroundColor" }],
          to: rgbDesc(hex)
        }]);
      });
    },
    createDocument: createDocument,
    fillBackground: fillBackground,
    makeTextLayer: makeTextLayer,
    measureDoc: measureDoc,
    tintActiveText: tintActiveText,
    loadFonts: loadFonts,
    selfTest: selfTest,
    sampleActive: sampleActive,
    rotateActive: rotateActive,
    clearSamplers: clearSamplers,
    readSamplerColors: readSamplerColors,
    addGuides: addGuides,
    saveFormat: saveFormat,
    saveThumb: saveThumb,
    saveProject: saveProject,
    openProject: openProject,
    capabilities: capabilities,
    paths: function () { return { create: lastCreatePath, text: lastTextPath }; }
  };
})();

function msgOf(err) {
  if (!err) return "Kesalahan tidak diketahui.";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try { return JSON.stringify(err); } catch (e) { return String(err); }
}

/* ============================ 5. REKOMENDASI ============================ */

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function styleWeight(style) {
  var s = String(style || "").toLowerCase();
  if (/thin|hairline/.test(s)) return 100;
  if (/extralight|ultralight/.test(s)) return 200;
  if (/light/.test(s)) return 300;
  if (/medium/.test(s)) return 500;
  if (/semibold|demibold|demi/.test(s)) return 600;
  if (/extrabold|ultrabold|heavy|black/.test(s)) return 800;
  if (/bold/.test(s)) return 700;
  return 400;
}

function scoreOf(item) {
  var s = 0;
  if (state.genre && item.genres.indexOf(state.genre) >= 0) s += 3;
  if (state.feel && item.feels.indexOf(state.feel) >= 0) s += 4;
  return s;
}

function allPalettes() {
  return PALETTES.concat(state.custom);
}

function rankedPalettes() {
  return allPalettes()
    .map(function (p) { return { p: p, s: scoreOf(p) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .map(function (x) { return x.p; });
}

function rankedPairings() {
  return PAIRINGS
    .map(function (p) { return { p: p, s: scoreOf(p) }; })
    .sort(function (a, b) { return b.s - a.s; })
    .map(function (x) { return x.p; });
}

function findById(list, id) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function currentPalette() {
  return findById(allPalettes(), state.paletteId) || rankedPalettes()[0];
}

function currentPairing() {
  return findById(PAIRINGS, state.pairingId) || rankedPairings()[0];
}

function closestWeight(styles, target) {
  var best = null, bestD = 1e9;
  for (var i = 0; i < styles.length; i++) {
    var d = Math.abs(styles[i].weight - target);
    if (d < bestD) { bestD = d; best = styles[i]; }
  }
  return best;
}

function resolveFont(spec, wantBold) {
  if (!spec) return { ps: null, family: "", installed: false, style: "" };
  var over = wantBold ? state.override.heading : state.override.body;
  if (over && over.ps) {
    return { ps: over.ps, family: over.family, installed: true, style: over.style || "" };
  }
  if (state.fonts.ok) {
    var aliases = (spec.aliases && spec.aliases.length) ? spec.aliases : [spec.family];
    for (var i = 0; i < aliases.length; i++) {
      var fam = state.fonts.byFamily[normName(aliases[i])];
      if (!fam || !fam.styles.length) continue;
      var styles = fam.styles.filter(function (s) { return !s.italic; });
      if (!styles.length) styles = fam.styles;
      var pick = closestWeight(styles, wantBold ? 800 : 400);
      if (pick) return { ps: pick.ps, family: fam.family, installed: true, style: pick.style };
    }
  }
  var cands = (wantBold ? spec.boldPS : spec.regularPS) || [];
  return { ps: cands[0] || null, family: spec.family, installed: false, style: "" };
}

function fontLabel(pairing) {
  return pairing.heading.family + " + " + pairing.body.family;
}

function wrapTitle(text, maxPerLine) {
  var words = String(text || "").split(/\s+/).filter(function (w) { return w.length; });
  if (!words.length) return ["JUDUL BUKU"];
  var lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (!cur) { cur = w; continue; }
    if ((cur + " " + w).length <= maxPerLine) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function titleLayout(text) {
  var t = String(text || "").trim() || "JUDUL BUKU";
  var maxPer = t.length <= 14 ? 99 : (t.length <= 24 ? 15 : (t.length <= 40 ? 17 : 19));
  var lines = wrapTitle(t, maxPer);
  var longest = 1;
  lines.forEach(function (l) { if (l.length > longest) longest = l.length; });
  return { lines: lines, longest: longest };
}

function sampleTitle() {
  var t = (state.cover.title || "").trim();
  return t || "JUDUL BUKU";
}

/* ============================ 6. RENDER ============================ */

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function cs(s) {
  return String(s).replace(/"/g, "'");
}

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setStatus(text, kind) {
  var el = $("#status");
  if (!el) return;
  el.textContent = text;
  el.className = kind || "";
}

function log(text) {
  state.logLines.unshift(text);
  if (state.logLines.length > 60) state.logLines.length = 60;
  var el = $("#log");
  if (el) {
    el.innerHTML = state.logLines.map(function (line) {
      var cls = /^!!|gagal|error|tidak bisa|tidak ada/i.test(line) ? "err" : "";
      return '<div class="' + cls + '">' + esc(line) + "</div>";
    }).join("");
  }
}

function chipHTML(label, on, act, id) {
  return '<button class="chip' + (on ? " is-on" : "") + '" data-act="' + act + '" data-id="' + esc(id) + '">' + esc(label) + "</button>";
}

function renderChips() {
  var gc = $("#genreChips");
  var fc = $("#feelChips");
  if (gc) gc.innerHTML = GENRES.map(function (g) {
    return chipHTML(g.label, state.genre === g.id, "genre", g.id);
  }).join("");

  if (fc) fc.innerHTML = FEELS.map(function (f) {
    return chipHTML(f.label, state.feel === f.id, "feel", f.id);
  }).join("");

  var g = findById(GENRES, state.genre);
  var gh = $("#genreHint");
  if (gh) gh.textContent = g ? g.hint : "";
}

/* Semua pemilih dibuat dari chip/buat sendiri: UXP tidak menjamin <select> dan
   daftar keluarga font di mesin ini ribuan, tidak layak masuk satu <option list>. */
function renderPickers() {
  var sc = $("#schemeChips");
  if (sc) sc.innerHTML = Object.keys(SCHEMES).map(function (k) {
    return chipHTML(SCHEMES[k].label, state.genScheme === k, "pick-scheme", k);
  }).join("");

  var tc = $("#toneChips");
  if (tc) tc.innerHTML =
    chipHTML("Gelap", state.genTone !== "light", "pick-tone", "dark") +
    chipHTML("Terang", state.genTone === "light", "pick-tone", "light");

  var pc = $("#presetChips");
  if (pc) pc.innerHTML = Object.keys(PRESETS).map(function (k) {
    return chipHTML(PRESETS[k].label, (state.cover.preset || "6x9") === k, "pick-preset", k);
  }).join("");

  var ff = $("#fFill");
  if (ff) ff.className = "chip wide" + (state.cover.fill ? " is-on" : "");
}

function swatchRowsHTML(p) {
  var c = p.colors;
  return ROLES.map(function (r) {
    var hex = normHex(c[r.key]) || "#000000";
    return '<div class="swatch-row">' +
      '<button class="swatch" style="background:' + hex + '" data-act="set-fg" data-role="' + r.key + '" title="Jadikan warna foreground"></button>' +
      '<div class="swatch-row-meta">' +
        '<div class="swatch-role">' + r.label + "</div>" +
        '<div class="swatch-sub">' + r.hint + "</div>" +
      "</div>" +
      '<button class="swatch-hex" data-act="copy-hex" data-role="' + r.key + '" title="Salin HEX">' + hex + "</button>" +
      '<button class="mini-btn" data-act="set-bg" data-role="' + r.key + '" title="Jadikan warna background">BG</button>' +
    "</div>";
  }).join("");
}

function badgeHTML(ratio, large) {
  var g = gradeOf(ratio, large);
  return '<div class="badge ' + g.cls + '">' + fmtRatio(ratio) + " &middot; " + g.text + "</div>";
}

function renderPaletteHero() {
  var host = $("#paletteHero");
  var p = currentPalette();
  if (!p) { host.innerHTML = ""; return; }
  var c = p.colors;
  var inkRatio = contrastRatio(c.ink, c.base);
  var accRatio = contrastRatio(c.accent, c.base);

  var tags = p.feels.map(function (f) {
    var fdef = findById(FEELS, f);
    return '<span class="chip mini">' + esc(fdef ? fdef.label : f) + "</span>";
  }).join("");
  var isCustom = !findById(PALETTES, p.id);

  host.innerHTML = '<div class="card is-on">' +
    '<div class="hero-top">' +
      '<div class="hero-main">' +
        '<div class="eyebrow">Palet terpilih</div>' +
        '<div class="card-title">' + esc(p.name) + "</div>" +
        '<div class="chips">' + tags + "</div>" +
      "</div>" +
      '<div class="hero-badges">' +
        badgeHTML(inkRatio, false) +
        badgeHTML(accRatio, true) +
      "</div>" +
    "</div>" +
    '<div class="swatch-rows">' + swatchRowsHTML(p) + "</div>" +
    '<p class="pair-why">' + esc(p.note) + "</p>" +
    '<div class="btn-row">' +
      '<button class="btn small primary" data-act="set-fg" data-role="base">FG: latar</button>' +
      '<button class="btn small" data-act="set-bg" data-role="base">BG: latar</button>' +
      '<button class="btn small" data-act="copy-css" data-scope="palette">Salin CSS</button>' +
      '<button class="btn small" data-act="fix-contrast">Perbaiki kontras</button>' +
      (isCustom ? '<button class="btn small" data-act="del-palette" data-id="' + esc(p.id) + '">Hapus simpanan</button>' : "") +
    "</div>" +
  "</div>";
}

function paletteCardHTML(p) {
  var c = p.colors;
  var cur = currentPalette();
  var isOn = cur && cur.id === p.id;
  var s = scoreOf(p);
  var isCustom = !findById(PALETTES, p.id);
  var strip = ["base", "surface", "accent", "ink", "muted"].map(function (k) {
    return '<span style="background:' + (normHex(c[k]) || "#000000") + '"></span>';
  }).join("");
  var tags = "";
  if (state.genre && p.genres.indexOf(state.genre) >= 0) tags += '<span class="chip mini good">kategori</span>';
  if (state.feel && p.feels.indexOf(state.feel) >= 0) tags += '<span class="chip mini good">rasa</span>';
  if (isCustom) tags += '<span class="chip mini">simpanan</span>';
  var tail = isCustom
    ? '<span class="palette-tail"><button class="card-x" data-act="del-palette" data-id="' + esc(p.id) + '" title="Hapus palet ini">&times;</button></span>'
    : '<span class="palette-score">' + (s > 0 ? "cocok" : "netral") + "</span>";

  return '<div class="card palette-card' + (isOn ? " is-on" : "") + '" data-act="pick-palette" data-id="' + esc(p.id) + '">' +
    '<div class="palette-strip">' + strip + "</div>" +
    '<div class="palette-line">' +
      '<span class="palette-name">' + esc(p.name) + "</span>" + tail +
    "</div>" +
    '<div class="chips">' + tags + "</div>" +
  "</div>";
}

function renderPaletteList() {
  var list = rankedPalettes();
  var cur = currentPalette();
  var others = list.filter(function (p) { return !cur || p.id !== cur.id; });
  var shown = others.slice(0, 8);
  /* Palet simpanan jangan sampai tidak terlihat hanya karena kalah skor. */
  others.forEach(function (p) {
    if (!findById(PALETTES, p.id) && shown.indexOf(p) < 0) shown.push(p);
  });
  var pc = $("#paletteCount");
  if (pc) pc.textContent = list.length + " palet" + (state.custom.length ? " (" + state.custom.length + " simpanan)" : "");
  $("#paletteList").innerHTML = shown.map(paletteCardHTML).join("");
}

/* Chip font jujur: tampilkan keluarga yang AKAN dipakai, bukan nama impian. */
function fontChip(kindLabel, want, resolved) {
  var cls = resolved.installed ? "good" : "warn";
  var txt;
  if (!resolved.installed) txt = want + " (belum terpasang)";
  else if (normName(resolved.family) !== normName(want)) txt = want + " \u2192 " + resolved.family + " (pengganti)";
  else txt = want + " terpasang";
  return '<span class="chip mini ' + cls + '">' + esc(kindLabel + ": " + txt) + "</span>";
}

function pairingCSS(pairing) {
  return "/* Judul */\nfont-family: " + pairing.heading.css + ";\n" +
    (pairing.heading.case === "upper" ? "text-transform: uppercase;\n" : "") +
    "letter-spacing: " + ((pairing.heading.tracking || 0) / 1000) + "em;\n\n" +
    "/* Teks */\nfont-family: " + pairing.body.css + ";\n" +
    "letter-spacing: " + ((pairing.body.tracking || 0) / 1000) + "em;";
}

function pairingCardHTML(pairing, variant) {
  var c = currentPalette().colors;
  var head = resolveFont(pairing.heading, true);
  var body = resolveFont(pairing.body, false);
  var headCss = '"' + head.family + '",' + pairing.heading.css;
  var bodyCss = '"' + body.family + '",' + pairing.body.css;
  var title = sampleTitle();
  var titleText = pairing.heading.case === "upper" ? title.toUpperCase() : title;
  var cur = currentPairing();
  var isOn = cur && cur.id === pairing.id;
  var big = variant === "hero";

  var statusChips =
    fontChip("judul", pairing.heading.family, head) +
    fontChip("teks", pairing.body.family, body);

  var usage = big ? '<p class="pair-usage">' + esc(pairing.usage) + "</p>" : "";

  return '<div class="card' + (isOn ? " is-on" : "") + '">' +
    '<div class="pair-sample" style="background:' + (normHex(c.base) || "#000000") + '">' +
      '<div class="pair-title" style="font-family:' + cs(headCss) + ";color:" + (normHex(c.accent) || "#FFFFFF") +
        ";letter-spacing:" + ((pairing.heading.tracking || 0) / 1000) + "em;" + (big ? "" : "font-size:15px;") + '">' +
        esc(titleText) + "</div>" +
      '<div class="pair-meta-line" style="font-family:' + cs(bodyCss) + ";color:" + (normHex(c.muted) || "#888888") + '">Aa Bb Cc &middot; 12345 &middot; ' +
        esc(state.cover.author || "Nama Penulis") + "</div>" +
    "</div>" +
    '<div class="pair-body">' +
      '<div class="pair-names">' +
        '<span style="font-family:' + cs(headCss) + '">' + esc(head.family || pairing.heading.family) + "</span>" +
        '<span class="plus">+</span>' +
        '<span style="font-family:' + cs(bodyCss) + '">' + esc(body.family || pairing.body.family) + "</span>" +
      "</div>" +
      '<div class="chips">' + statusChips + "</div>" +
      '<p class="pair-why">' + esc(pairing.why) + "</p>" +
      usage +
      '<div class="btn-row">' +
        '<button class="btn small primary" data-act="type-text" data-id="' + esc(pairing.id) + '">Buat teks</button>' +
        '<button class="btn small" data-act="pick-pairing" data-id="' + esc(pairing.id) + '">Pilih</button>' +
        '<button class="btn small" data-act="copy-css" data-scope="type" data-id="' + esc(pairing.id) + '">Salin CSS</button>' +
        '<button class="btn small" data-act="copy-fonts" data-id="' + esc(pairing.id) + '">Salin nama</button>' +
      "</div>" +
    "</div>" +
  "</div>";
}

function renderPairingHero() {
  var host = $("#pairingHero");
  if (!host) return;
  var cur = currentPairing();
  if (!cur) { host.innerHTML = ""; return; }
  var head = resolveFont(cur.heading, true);
  var best = 0;
  PAIRINGS.forEach(function (p) { if (scoreOf(p) > best) best = scoreOf(p); });
  var note = head.installed ? (head.style || "terpasang") : "font belum terpasang";
  if (state.feel && best < 4) {
    var fd = findById(FEELS, state.feel);
    note += " \u00b7 tidak ada pasangan ber-rasa " + (fd ? fd.label : state.feel);
  }
  var header =
    '<div class="block"><div class="block-head">' +
      '<h2>Pasangan terpilih</h2>' +
      '<span class="hint">' + esc(note) + "</span>" +
    "</div></div>";
  host.innerHTML = header + pairingCardHTML(cur, "hero");
}

function renderPairingList() {
  var cur = currentPairing();
  var ranked = rankedPairings();
  var others = ranked.filter(function (p) { return !cur || p.id !== cur.id; }).slice(0, 8);
  var matched = ranked.filter(function (p) { return scoreOf(p) > 0; }).length;
  var tc = $("#typeCount");
  if (tc) tc.textContent = PAIRINGS.length + " pasangan \u00b7 " + matched + " cocok";
  $("#pairingList").innerHTML = others.map(function (p) { return pairingCardHTML(p, "list"); }).join("");
}

function coverInnerHTML(fontSize) {
  var p = currentPalette();
  var pairing = currentPairing();
  var c = p.colors;
  var head = resolveFont(pairing.heading, true);
  var body = resolveFont(pairing.body, false);
  var headCss = '"' + head.family + '",' + pairing.heading.css;
  var bodyCss = '"' + body.family + '",' + pairing.body.css;
  var layout = titleLayout(sampleTitle());
  /* v1.2: gabung dulu dengan "<br />" lalu di-esc() -> tag jadi teks literal. */
  var titleText = layout.lines.map(function (l) {
    return esc(pairing.heading.case === "upper" ? l.toUpperCase() : l);
  }).join("<br />");
  var sub = (state.cover.subtitle || "").trim();
  var author = (state.cover.author || "").trim();

  return '<div class="cover" style="font-size:' + fontSize + "px;background:" + (normHex(c.base) || "#000000") + ";color:" + (normHex(c.ink) || "#FFFFFF") + '">' +
    '<div class="cover-inner">' +
      '<div class="cover-head">' +
        '<div class="cover-title" style="font-family:' + cs(headCss) + ";color:" + (normHex(c.accent) || "#FFFFFF") +
          ";letter-spacing:" + ((pairing.heading.tracking || 0) / 1000) + 'em">' + titleText + "</div>" +
        '<div class="cover-rule" style="background:' + (normHex(c.accent) || "#FFFFFF") + '"></div>' +
        (sub ? '<div class="cover-sub" style="font-family:' + cs(bodyCss) + ";color:" + (normHex(c.muted) || "#888888") + '">' + esc(sub) + "</div>" : "") +
      "</div>" +
      '<div class="cover-foot">' +
        (author ? '<div class="cover-author" style="font-family:' + cs(bodyCss) + '">' + esc(author) + "</div>" : "") +
      "</div>" +
    "</div>" +
  "</div>";
}

function renderCoverStage() {
  var stage = $("#coverStage");
  if (!stage) return;
  var rect = stage.getBoundingClientRect ? stage.getBoundingClientRect() : { width: 320 };
  var w = rect.width || 320;
  var layout = titleLayout(sampleTitle());
  var track = (currentPairing().heading.tracking || 0) / 1000;
  var byWidth = (0.94 * w) / (layout.longest * (0.66 + track) + 2.0);
  var byHeight = 0.145 * w;
  var fs = Math.max(12, Math.round(Math.min(byWidth, byHeight)));
  stage.innerHTML = coverInnerHTML(fs);
  var p = currentPalette();
  var pairing = currentPairing();
  var head = resolveFont(pairing.heading, true);
  var cap = $("#coverCaption");
  if (cap) cap.textContent = p.name + " · " + head.family + " + " + resolveFont(pairing.body, false).family;
}

/* Panel cetak: liput penuh + ekspor. Semua angka datang dari wrapGeom(). */
function renderWrap() {
  var g = wrapGeom();
  var fmtHost = $("#wrapFormatChips");
  if (fmtHost) {
    fmtHost.innerHTML = Object.keys(WRAP_FORMATS).map(function (k) {
      return chipHTML(WRAP_FORMATS[k].label, state.wrap.format === k, "pick-format", k);
    }).join("");
  }
  var papHost = $("#wrapPaperChips");
  if (papHost) {
    papHost.innerHTML = Object.keys(PAPERS).map(function (k) {
      return chipHTML(PAPERS[k].label, state.wrap.paper === k, "pick-paper", k);
    }).join("");
  }
  var blHost = $("#wrapBleedChips");
  if (blHost) {
    blHost.innerHTML = Object.keys(BLEEDS).map(function (k) {
      return chipHTML(BLEEDS[k].label, state.wrap.bleed === k, "pick-bleed", k);
    }).join("");
  }
  var sp = $("#fSpine");
  if (sp) {
    sp.textContent = state.wrap.spine ? "Teks punggung: aktif" : "Teks punggung: mati";
    sp.classList.toggle("is-on", state.wrap.spine);
  }

  var sum = $("#wrapSummary");
  if (sum) {
    sum.innerHTML =
      '<div class="metric"><b>Sheet</b> ' + g.totalW + " x " + g.totalH + ' px</div>' +
      '<div class="metric"><b>Trim</b> ' + (g.trimW / g.dpi).toFixed(2) + " x " + (g.trimH / g.dpi).toFixed(2) + " in (" +
        Math.round(g.mm.trimW) + " x " + Math.round(g.mm.trimH) + ' mm)</div>' +
      '<div class="metric"><b>Punggung</b> ' + g.spineMm.toFixed(1) + " mm (" + g.spineIn.toFixed(2) + " in) dari " + g.pages + " hal " + esc(g.paper.label.toLowerCase()) + '</div>' +
      '<div class="metric"><b>Bleed</b> ' + g.bleed.mm + " mm tiap sisi</div>" +
      '<div class="metric"><b>Ukuran file ±</b> ' + Math.round(g.totalW * g.totalH * 3 / 1024 / 1024) + " MB (RGB 8-bit)</div>";
  }
  var warn = $("#wrapWarnings");
  if (warn) {
    warn.innerHTML = g.warnings.length
      ? g.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join("")
      : '<div class="hint">Tidak ada peringatan. Siap dibangun.</div>';
  }
}

function renderFontStatus() {
  var el = $("#fontsStatus");
  if (!el) return;
  if (!PS.live) {
    el.textContent = "Mode demo (browser): daftar font Photoshop tidak tersedia. Buka panel di Photoshop untuk membaca font terpasang.";
    return;
  }
  if (!state.fonts.loaded) {
    el.textContent = "Membaca daftar font dari Photoshop…";
    return;
  }
  if (state.fonts.ok) {
    el.textContent = state.fonts.styleCount + " gaya font / " + state.fonts.famCount +
      " keluarga terbaca (" + state.fonts.ms + " ms). Pasangan font dicocokkan otomatis ke yang terpasang.";
  } else {
    el.textContent = "Gagal membaca font: " + (state.fonts.error || "tidak diketahui") + ". Pasangan font tetap bisa dipakai, tapi pastikan font-nya terpasang.";
  }
}

var PICK_LIMIT = 60;
var pickTimer = null;

/* Pemilih font: chip + kolom saring + daftar terbatas. Menaruh ribuan opsi (mesin
   ini punya >4.000 keluarga) membuat panel berat pada setiap render. */
function renderFontPickers() {
  var host = $("#overrideBox");
  if (!host) return;
  if (!PS.live || !state.fonts.loaded) { host.innerHTML = ""; return; }
  if (!state.fonts.ok) {
    host.innerHTML = '<p class="lede">Daftar font gagal dibaca, jadi penggantian font tidak tersedia.</p>';
    return;
  }

  var fams = Object.keys(state.fonts.byFamily).map(function (k) { return state.fonts.byFamily[k]; });
  fams.sort(function (a, b) { return a.family.localeCompare(b.family); });

  var html = "";
  ["heading", "body"].forEach(function (kind) {
    var ov = state.override[kind];
    var label = kind === "heading" ? "Ganti font judul" : "Ganti font teks";
    var open = state.fontPick === kind;
    html += '<div class="field"><span>' + label + "</span>" +
      '<button class="chip wide' + (open ? " is-on" : "") + '" data-act="toggle-pick" data-id="' + kind + '">' +
      esc(ov ? ov.family + (ov.style ? " " + ov.style : "") : "ikut pasangan font") + "</button></div>";
    if (!open) return;

    var q = normName(state.fontQuery || "");
    var shown = q ? fams.filter(function (f) { return normName(f.family).indexOf(q) >= 0; }) : fams;
    var rows = shown.slice(0, PICK_LIMIT).map(function (f) {
      return '<button class="pick-opt' + (ov && ov.family === f.family ? " is-on" : "") + '" data-act="pick-family" data-id="' +
        kind + '" data-name="' + esc(f.family) + '">' + esc(f.family) + "</button>";
    }).join("");

    html += '<div class="pick-pop">' +
      '<input class="input" id="pickQuery" value="' + esc(state.fontQuery) + '" placeholder="ketik untuk menyaring…" spellcheck="false" />' +
      '<div class="pick-list">' + (rows || '<div class="pick-empty">Tidak ada keluarga yang cocok.</div>') + "</div>" +
      '<div class="pick-foot">' + shown.length + " keluarga" +
        (shown.length > PICK_LIMIT ? " · menampilkan " + PICK_LIMIT + " pertama, ketik untuk mempersempit" : "") + "</div>" +
      (ov ? '<div class="btn-row"><button class="btn small" data-act="clear-override" data-id="' + kind + '">Lepas, ikut pasangan</button></div>' : "") +
    "</div>";
  });

  host.innerHTML = html;

  var qEl = $("#pickQuery");
  if (qEl) {
    qEl.addEventListener("input", function () {
      state.fontQuery = qEl.value;
      if (pickTimer) clearTimeout(pickTimer);
      pickTimer = setTimeout(function () {
        renderFontPickers();
        var again = $("#pickQuery");
        if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) {} }
      }, 180);
    });
  }
}

function setOverride(kind, family) {
  if (!family) {
    state.override[kind] = null;
  } else {
    var fam = state.fonts.byFamily[normName(family)];
    if (!fam) return;
    var styles = fam.styles.filter(function (s) { return !s.italic; });
    if (!styles.length) styles = fam.styles;
    var pick = closestWeight(styles, kind === "heading" ? 800 : 400);
    if (!pick) return;
    state.override[kind] = { family: fam.family, ps: pick.ps, style: pick.style };
  }
  state.fontPick = null;
  saveState();
  renderAll();
  setStatus(family ? ("Font " + (kind === "heading" ? "judul" : "teks") + ": " + family) : "Font kembali ikut pasangan.", "ok");
}

function syncCoverInputs() {
  var t = $("#fTitle"), s = $("#fSubtitle"), a = $("#fAuthor"), g = $("#genHex");
  if (t) t.value = state.cover.title;
  if (s) s.value = state.cover.subtitle;
  if (a) a.value = state.cover.author;
  if (g) g.value = state.genHex;
  var pg = $("#fPages"), pb = $("#fPublisher"), bb = $("#fBlurb"), ib = $("#fIsbn");
  if (pg) pg.value = state.wrap.pages;
  if (pb) pb.value = state.wrap.publisher;
  if (bb) bb.value = state.wrap.blurb;
  if (ib) ib.value = state.wrap.isbn;
}

function renderAll() {
  renderChips();
  renderPickers();
  renderPaletteHero();
  renderPaletteList();
  renderPairingHero();
  renderPairingList();
  renderCoverStage();
  renderWrap();
  renderFontStatus();
  renderFontPickers();
}


/* ============================ 7. AKSI PHOTOSHOP ============================ */

function guard(promise, okMessage) {
  return promise.then(function () {
    if (okMessage) setStatus(okMessage, "ok");
  }).catch(function (err) {
    log("Gagal: " + msgOf(err));
    setStatus("Gagal — lihat log di tab Bangun.", "err");
  });
}

function doSetColor(role, kind) {
  var p = currentPalette();
  var hex = p.colors[role];
  if (!hex) return;
  if (!PS.live) {
    log("[demo] set " + (kind === "bg" ? "background" : "foreground") + " = " + hex);
    setStatus("Demo: " + hex + " — jalankan di Photoshop untuk menerapkan.", "");
    return;
  }
  guard(PS.setColor(hex, kind), (kind === "bg" ? "Background" : "Foreground") + " = " + hex);
  log((kind === "bg" ? "Background" : "Foreground") + " → " + hex + " (" + role + ")");
}

function buildCover(mode) {
  var palette = currentPalette();
  var pairing = currentPairing();
  var preset = PRESETS[state.cover.preset] || PRESETS["6x9"];
  var head = resolveFont(pairing.heading, true);
  var body = resolveFont(pairing.body, false);

  if (!head.ps || !body.ps) {
    setStatus("Font belum tersedia.", "err");
    log("Gagal: nama PostScript font tidak diketahui.");
    return;
  }
  if (!head.installed || !body.installed) {
    log("Catatan: " + pairing.heading.family + " / " + pairing.body.family + " belum terdeteksi terpasang. Photoshop akan memakai fallback.");
  }

  var job = guard(PS.run("Sampul: bangun sampul", function () {
    var docPromise = mode === "new"
      ? PS.createDocument(preset, "Sampul " + sampleTitle().slice(0, 20))
      : Promise.resolve(PS.mod.app.activeDocument);

    return docPromise.then(function (doc) {
      if (!doc) throw new Error("Tidak ada dokumen aktif. Pakai 'Bangun sampul baru'.");
      return PS.measureDoc(doc, preset).then(function (size) {
        var h = size.h, w = size.w, dpi = size.dpi || 300;
        var hIn = h / dpi;

        var layout = titleLayout(sampleTitle());
        var titleText = layout.lines.join("\r");
        var track = (pairing.heading.tracking || 0) / 1000;
        var leadingFactor = 0.95;

        /* Anggaran blok judul: ~30% tinggi kanvas, dibagi jumlah baris.
           v1.2 memakai 8,5% x tinggi tanpa peduli jumlah baris -> judul 3 baris meluber. */
        var byHeightPt = (0.30 * hIn * 72) / (layout.lines.length * leadingFactor);
        var byWidthPt = (0.94 * w * 72 / dpi) / (layout.longest * (0.66 + track) + 1.0);
        var titlePt = Math.max(10, Math.min(byHeightPt, byWidthPt));
        log("Kanvas " + Math.round(w) + "x" + Math.round(h) + " px @" + Math.round(dpi) + " dpi (" + size.src + "), judul " +
          layout.lines.length + " baris \u00b7 " + Math.round(titlePt) + " pt");

        var chain = Promise.resolve();
        if (mode === "new" && state.cover.fill) {
          chain = chain.then(function () { return PS.fillBackground(palette.colors.base); });
        }
        chain = chain.then(function () {
          return PS.makeTextLayer({
            name: "Judul",
            text: titleText,
            font: head.ps,
            size: titlePt,
            color: palette.colors.accent,
            tracking: pairing.heading.tracking || 0,
            textCase: pairing.heading.case,
            leadingFactor: leadingFactor,
            justify: "center",
            cx: w / 2,
            cy: h * 0.235
          });
        });

        var sub = (state.cover.subtitle || "").trim();
        if (sub) {
          chain = chain.then(function () {
            return PS.makeTextLayer({
              name: "Subjudul",
              text: sub,
              font: body.ps,
              size: titlePt * 0.30,
              color: palette.colors.muted,
              tracking: 120,
              textCase: "upper",
              justify: "center",
              cx: w / 2,
              cy: h * 0.395
            });
          });
        }

        var author = (state.cover.author || "").trim();
        if (author) {
          chain = chain.then(function () {
            return PS.makeTextLayer({
              name: "Penulis",
              text: author,
              font: body.ps,
              size: titlePt * 0.34,
              color: palette.colors.ink,
              tracking: 60,
              textCase: "upper",
              justify: "center",
              cx: w / 2,
              cy: h * 0.885
            });
          });
        }
        return chain;
      });
    });
  }), "Sampul dibuat.");

  job.then(function () {
    var pa = PS.paths();
    if (pa.create || pa.text) {
      log("Jalur deskriptor: dokumen=" + (pa.create || "-") + ", teks=" + (pa.text || "-") +
        " (varian dasar = enum teks tidak diterima PS ini)");
    }
  }, function () {});

  log("Bangun sampul: " + palette.name + " + " + fontLabel(pairing) + (mode === "new" ? " (dokumen baru)" : " (dokumen aktif)"));
}

/* Garis trim + batas bleed untuk sheet liput penuh. */
function wrapGuideLines(g) {
  var lines = [];
  [g.back.x0, g.back.x1, g.spine.x1, g.front.x1, g.totalW - g.bleedPx].forEach(function (x) {
    lines.push({ o: "vertical", p: Math.round(x) });
  });
  [g.bleedPx, g.totalH - g.bleedPx].forEach(function (y) {
    lines.push({ o: "horizontal", p: Math.round(y) });
  });
  return lines;
}

function buildWrap() {
  var g = wrapGeom();
  var palette = currentPalette();
  var pairing = currentPairing();
  var head = resolveFont(pairing.heading, true);
  var body = resolveFont(pairing.body, false);
  if (!head.ps || !body.ps) { setStatus("Font belum tersedia.", "err"); return; }

  log("Liput penuh " + g.totalW + "x" + g.totalH + " px @" + g.dpi + " dpi; punggung " +
    g.spineMm.toFixed(1) + " mm dari " + g.pages + " halaman " + g.paper.label.toLowerCase() +
    "; bleed " + g.bleed.mm + " mm (" + g.format.label + ")");
  g.warnings.forEach(function (w) { log("!! " + w); });

  var job = guard(PS.run("Sampul: bangun liput penuh", function () {
    return PS.createDocument({ w: g.totalW, h: g.totalH, dpi: g.dpi }, "Liput " + sampleTitle().slice(0, 18)).then(function () {
      var chain = Promise.resolve();
      if (state.cover.fill) chain = chain.then(function () { return PS.fillBackground(palette.colors.base); });
      chain = chain.then(function () { return PS.addGuides(wrapGuideLines(g)); });

      var hIn = g.trimH / g.dpi;
      var layout = titleLayout(sampleTitle());
      var titleText = layout.lines.join("\r");
      var track = (pairing.heading.tracking || 0) / 1000;
      var byHeightPt = (0.30 * hIn * 72) / (layout.lines.length * 0.95);
      var byWidthPt = (0.86 * g.trimW * 72 / g.dpi) / (layout.longest * (0.66 + track) + 1.0);
      var titlePt = Math.max(10, Math.min(byHeightPt, byWidthPt));
      var frontCx = (g.front.x0 + g.front.x1) / 2;

      chain = chain.then(function () {
        return PS.makeTextLayer({
          name: "Judul", text: titleText, font: head.ps, size: titlePt,
          color: palette.colors.accent, tracking: pairing.heading.tracking || 0,
          textCase: pairing.heading.case, leadingFactor: 0.95, justify: "center",
          cx: frontCx, cy: g.bleedPx + g.trimH * 0.235
        });
      });

      var sub = (state.cover.subtitle || "").trim();
      if (sub) {
        chain = chain.then(function () {
          return PS.makeTextLayer({
            name: "Subjudul", text: sub, font: body.ps, size: titlePt * 0.30,
            color: palette.colors.muted, tracking: 120, textCase: "upper",
            justify: "center", cx: frontCx, cy: g.bleedPx + g.trimH * 0.395
          });
        });
      }

      var author = (state.cover.author || "").trim();
      if (author) {
        chain = chain.then(function () {
          return PS.makeTextLayer({
            name: "Penulis", text: author, font: body.ps, size: titlePt * 0.34,
            color: palette.colors.ink, tracking: 60, textCase: "upper",
            justify: "center", cx: frontCx, cy: g.bleedPx + g.trimH * 0.885
          });
        });
      }

      /* Punggung: satu baris, diputar 90°, hanya kalau lebarnya memadai. */
      if (state.wrap.spine) {
        if (!g.spineTextOk) {
          chain = chain.then(function () {
            log("!! Teks punggung dilewati: " + g.spineMm.toFixed(1) + " mm di bawah patokan " +
              g.format.spineTextPages + " halaman untuk " + g.format.label + ".");
            return null;
          });
        } else {
          var spineText = (sampleTitle().replace(/[\r\n]+/g, " ") + (author ? "  \u00b7  " + author : "")).toUpperCase();
          var spinePt = Math.max(8, Math.min(
            g.spineIn * 72 * 0.42,
            (g.trimH * 0.78 * 72 / g.dpi) / (spineText.length * 0.62)
          ));
          chain = chain.then(function () {
            return PS.makeTextLayer({
              name: "Punggung", text: spineText, font: head.ps, size: spinePt,
              color: palette.colors.accent, tracking: pairing.heading.tracking || 0,
              textCase: "none", justify: "center",
              cx: (g.spine.x0 + g.spine.x1) / 2, cy: g.totalH / 2
            });
          }).then(function () {
            return PS.rotateActive(90).catch(function (e) {
              log("!! Putar punggung gagal: " + msgOf(e) + " — putar manual lalu paskan.");
            });
          });
        }
      }

      var blurb = (state.wrap.blurb || "").trim();
      if (blurb) {
        chain = chain.then(function () {
          return PS.makeTextLayer({
            name: "Blurb", text: blurb, font: body.ps, size: Math.max(8, titlePt * 0.22),
            color: palette.colors.ink, tracking: 10, textCase: "none",
            leadingFactor: 1.35, justify: "center",
            cx: (g.back.x0 + g.back.x1) / 2, cy: g.bleedPx + g.trimH * 0.42
          });
        });
      }

      var pub = (state.wrap.publisher || "").trim();
      if (pub) {
        chain = chain.then(function () {
          return PS.makeTextLayer({
            name: "Penerbit", text: pub, font: body.ps, size: Math.max(8, titlePt * 0.20),
            color: palette.colors.muted, tracking: 80, textCase: "upper",
            justify: "center", cx: (g.back.x0 + g.back.x1) / 2, cy: g.bleedPx + g.trimH * 0.94
          });
        });
      }
      return chain;
    });
  }), "Liput penuh dibangun.");

  job.then(function () {
    var pa = PS.paths();
    if (pa.create || pa.text) {
      log("Jalur deskriptor: dokumen=" + (pa.create || "-") + ", teks=" + (pa.text || "-"));
    }
  }, function () {});
}

/* ---- ekspor berkas ---- */

function doExport(fmt, suggested) {
  if (!PS.live) { log("[demo] ekspor " + fmt + " butuh Photoshop."); setStatus("Mode demo — ekspor butuh Photoshop.", "err"); return; }
  if (!PS.mod.app || !PS.mod.app.activeDocument) { setStatus("Tidak ada dokumen aktif.", "err"); return; }
  setStatus("Menyimpan " + fmt.toUpperCase() + "…");
  PS.saveFormat(fmt, suggested).then(function (res) {
    if (!res) return;
    if (res.cancelled) { setStatus("Dibatalkan."); return; }
    log("Tersimpan " + res.name + " (lewat " + res.via + ").");
    setStatus("Tersimpan: " + res.name, "ok");
  }, function (e) {
    log("!! Ekspor " + fmt + ": " + msgOf(e));
    setStatus("Ekspor gagal — lihat log.", "err");
  });
}

function doThumb(maxSide) {
  if (!PS.live) { log("[demo] thumbnail butuh Photoshop."); return; }
  if (!PS.mod.app || !PS.mod.app.activeDocument) { setStatus("Tidak ada dokumen aktif.", "err"); return; }
  setStatus("Membuat thumbnail…");
  PS.saveThumb("thumbnail-sampul.png", maxSide || 300).then(function (res) {
    if (!res) return;
    if (res.cancelled) { setStatus("Dibatalkan."); return; }
    log("Thumbnail " + maxSide + " px tersimpan: " + res.name);
    setStatus("Thumbnail tersimpan.", "ok");
  }, function (e) {
    log("!! Thumbnail: " + msgOf(e));
    setStatus("Thumbnail gagal.", "err");
  });
}

/* ---- ekstraksi palet dari dokumen aktif ---- */

function extractFromDocument() {
  if (!PS.live) {
    log("[demo] ekstraksi warna butuh Photoshop.");
    setStatus("Mode demo — ekstraksi butuh Photoshop.", "err");
    return;
  }
  setStatus("Mengambil warna dari dokumen aktif…");
  PS.run("Sampul: ambil warna dokumen", function () {
    var doc = PS.mod.app.activeDocument;
    if (!doc) throw new Error("Tidak ada dokumen aktif.");
    return PS.measureDoc(doc).then(function (size) { return PS.sampleActive(size); });
  }).then(function (res) {
    if (!res) return;
    var pal = paletteFromSamples(res.colors);
    if (!pal) {
      setStatus("Warna tidak terbaca dari dokumen.", "err");
      log("!! Ekstraksi: sampel kosong (" + res.colors.length + "/" + res.points + " titik).");
      return;
    }
    var name = uniqueName("Dari dokumen", allPalettes());
    var saved = pushCustom({
      id: "doc-" + Date.now(),
      name: name,
      genres: [state.genre],
      feels: state.feel ? [state.feel] : [],
      colors: pal.colors,
      note: "Ekstraksi dokumen aktif: " + res.colors.length + " sampel / " + res.points + " titik (" + res.rounds + " ronde sampler)."
    });
    if (saved) {
      state.paletteId = saved.id;
      saveState();
      renderAll();
      setStatus("Palet diambil: " + saved.name, "ok");
    } else {
      setStatus("Warna sama dengan palet yang sudah ada — tidak disimpan lagi.");
    }
    log("Ekstraksi: " + res.colors.length + "/" + res.points + " sampel, warna teratas " + pal.top.join(" ") + ".");
  }, function (e) {
    log("!! Ekstraksi warna: " + msgOf(e));
    setStatus("Ekstraksi gagal — lihat log.", "err");
  });
}

/* Menyalin sambil menunggu hasilnya. v1.2 memanggil clipboard tanpa menunggu,
   jadi status "Disalin" bisa muncul padahal gagal. navigator.clipboard dipakai
   lebih dulu karena itu yang dipakai panel bawaan Photoshop. */
function copyText(text) {
  var txt = String(text === null || text === undefined ? "" : text);

  function viaNav() {
    if (!navigator || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return Promise.reject(new Error("navigator.clipboard tidak ada"));
    }
    return Promise.resolve(navigator.clipboard.writeText(txt));
  }
  function viaUxp() {
    var cb = PS.uxp && PS.uxp.clipboard;
    if (!cb) return Promise.reject(new Error("uxp.clipboard tidak ada"));
    if (typeof cb.writeText === "function") return Promise.resolve(cb.writeText(txt));
    if (typeof cb.copy === "function") return Promise.resolve(cb.copy(txt));
    return Promise.reject(new Error("uxp.clipboard tanpa metode tulis"));
  }
  function viaArea() {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      var done = document.execCommand ? document.execCommand("copy") : false;
      document.body.removeChild(ta);
      return done ? Promise.resolve() : Promise.reject(new Error("execCommand ditolak"));
    } catch (e) { return Promise.reject(e); }
  }

  return viaNav().then(function () { return "navigator.clipboard"; }, function () {
    return viaUxp().then(function () { return "uxp.clipboard"; }, function () {
      return viaArea().then(function () { return "execCommand"; }, function () { return null; });
    });
  }).then(function (via) {
    if (via) log("Salin via " + via + ": " + txt.split("\n")[0].slice(0, 46));
    return !!via;
  });
}

function copyWithStatus(text, okMsg) {
  setStatus("Menyalin…");
  copyText(text).then(function (ok) {
    setStatus(ok ? okMsg : "Tidak bisa menyalin — clipboard ditolak lingkungan.", ok ? "ok" : "err");
  });
}

function cssForPalette(p) {
  var c = p.colors;
  return "/* " + p.name + " */\n:root {\n" +
    "  --base: " + c.base + ";\n" +
    "  --surface: " + c.surface + ";\n" +
    "  --accent: " + c.accent + ";\n" +
    "  --ink: " + c.ink + ";\n" +
    "  --muted: " + c.muted + ";\n" +
    "}";
}

/* ============================ 8. EVENT ============================ */

function setTab(name) {
  $$("#tabs .tab").forEach(function (t) {
    t.classList.toggle("is-active", t.getAttribute("data-tab") === name);
  });
  $$(".tabpane").forEach(function (p) {
    p.classList.toggle("is-active", p.getAttribute("data-pane") === name);
  });
  if (name === "bangun") renderCoverStage();
}

function pickPaletteById(id) {
  var p = findById(allPalettes(), id);
  if (!p) return;
  state.paletteId = id;
  saveState();
  renderAll();
  setStatus("Palet: " + p.name);
}

function pickPairingById(id) {
  var p = findById(PAIRINGS, id);
  if (!p) return;
  state.pairingId = id;
  saveState();
  renderAll();
  setStatus("Font: " + fontLabel(p));
}

function handleAction(act, el) {
  var role = el.getAttribute("data-role");
  var id = el.getAttribute("data-id");
  var p, hex, pair;

  switch (act) {
    case "help":
      $("#helpOverlay").classList.add("is-open");
      break;

    case "close-help":
      $("#helpOverlay").classList.remove("is-open");
      break;

    case "genre":
      state.genre = id;
      saveState();
      renderAll();
      break;

    case "feel":
      state.feel = (state.feel === id) ? null : id;
      saveState();
      renderAll();
      break;

    case "clear-feel":
      state.feel = null;
      saveState();
      renderAll();
      break;

    case "pick-palette":
      pickPaletteById(id);
      break;

    case "pick-pairing":
      pickPairingById(id);
      break;

    case "pick-hue":
      hex = normHex(el.getAttribute("data-hex"));
      if (hex) {
        state.genHex = hex;
        var gh = $("#genHex");
        if (gh) gh.value = hex;
        setStatus("Warna dasar: " + hex);
      }
      break;

    case "set-fg":
      doSetColor(role, "fg");
      break;

    case "set-bg":
      doSetColor(role, "bg");
      break;

    case "fg-base":
      doSetColor("base", "fg");
      break;

    case "bg-accent":
      doSetColor("accent", "bg");
      break;

    case "copy-hex":
      p = currentPalette();
      hex = normHex(p.colors[role]) || p.colors[role];
      copyWithStatus(hex, "Disalin: " + hex);
      break;

    case "copy-css":
      if (el.getAttribute("data-scope") === "palette") {
        copyWithStatus(cssForPalette(currentPalette()), "CSS palet disalin.");
      } else {
        pair = findById(PAIRINGS, id) || currentPairing();
        copyWithStatus(pairingCSS(pair), "CSS tipografi disalin.");
      }
      break;

    case "copy-fonts":
      pair = findById(PAIRINGS, id) || currentPairing();
      copyWithStatus(pair.heading.family + " (judul) + " + pair.body.family + " (teks)", "Nama font disalin.");
      break;

    case "copy-font-list": {
      var fams = Object.keys(state.fonts.byFamily).map(function (k) { return state.fonts.byFamily[k].family; });
      if (!fams.length) { setStatus("Daftar font belum dibaca.", "err"); break; }
      fams.sort();
      copyWithStatus(fams.join("\n"), fams.length + " nama font disalin.");
      break;
    }

    case "fix-contrast": {
      var baseP = currentPalette();
      var before = contrastRatio(baseP.colors.accent, baseP.colors.base);
      var accent = adjustForContrast(baseP.colors.accent, baseP.colors.base, 4.5);

      /* v1.2 selalu menyimpan palet baru meski tidak ada yang berubah -> 23 dari 28
         palet kurasi hanya mendapat duplikat sampah di penyimpanan. */
      if (before >= 4.5) {
        setStatus("Aksen sudah " + fmtRatio(before) + " — tidak ada yang perlu diperbaiki.", "ok");
        log("Kontras aksen " + fmtRatio(before) + " sudah aman; palet duplikat tidak dibuat.");
        break;
      }
      if (accent === baseP.colors.accent) {
        setStatus("Aksen mentok di " + fmtRatio(before) + " — tidak bisa digeser lebih jauh.", "err");
        log("!! Tidak bisa menaikkan kontras " + baseP.colors.accent + " di atas " + baseP.colors.base);
        break;
      }

      var after = contrastRatio(accent, baseP.colors.base);
      var fixed = {
        id: "fix-" + Date.now(),
        name: baseP.name + " (kontras)",
        genres: baseP.genres.slice(),
        feels: baseP.feels.slice(),
        colors: {
          base: baseP.colors.base,
          surface: baseP.colors.surface,
          accent: accent,
          ink: baseP.colors.ink,
          muted: baseP.colors.muted
        },
        note: "Aksen digeser terang/gelap dari " + fmtRatio(before) + " menjadi " + fmtRatio(after) + " terhadap latar — judul tetap terbaca saat diperkecil."
      };
      var savedFix = pushCustom(fixed);
      if (!savedFix) { setStatus("Palet hasil itu sudah tersimpan.", "ok"); break; }
      state.paletteId = savedFix.id;
      saveState();
      renderAll();
      setStatus("Kontras aksen: " + fmtRatio(before) + " \u2192 " + fmtRatio(after), "ok");
      log("Aksen " + baseP.colors.accent + " \u2192 " + accent + " (" + fmtRatio(before) + " \u2192 " + fmtRatio(after) + ")");
      break;
    }

    case "generate": {
      var hexField = $("#genHex");
      var hexIn = normHex(hexField ? hexField.value : state.genHex);
      if (!hexIn) { setStatus("HEX tidak valid (contoh: #A6392E).", "err"); return; }
      if (hexField) hexField.value = hexIn;
      state.genHex = hexIn;
      var gen = generatePalette(hexIn, state.genScheme, state.genTone);
      var savedGen = pushCustom(gen);
      if (!savedGen) {
        setStatus("Palet seperti itu sudah ada dalam daftar.", "ok");
        log("Generator: hasil identik dengan palet yang sudah ada — tidak disimpan dua kali.");
        break;
      }
      state.paletteId = savedGen.id;
      saveState();
      renderAll();
      setStatus("Palet baru: " + savedGen.name, "ok");
      log("Generator: " + savedGen.name + " (aksen " + savedGen.colors.accent + ", " +
        fmtRatio(contrastRatio(savedGen.colors.accent, savedGen.colors.base)) + ")");
      break;
    }

    case "del-palette": {
      var n0 = state.custom.length;
      state.custom = state.custom.filter(function (q) { return q.id !== id; });
      if (state.paletteId === id) state.paletteId = null;
      saveState();
      renderAll();
      setStatus("Palet simpanan dihapus: " + (n0 - state.custom.length) + ".", "ok");
      break;
    }

    case "prune-custom": {
      var m0 = state.custom.length;
      state.custom = pruneCustom(state.custom);
      if (state.paletteId && !findById(allPalettes(), state.paletteId)) state.paletteId = null;
      saveState();
      renderAll();
      setStatus("Palet simpanan " + m0 + " \u2192 " + state.custom.length + " (duplikat & rusak dibuang).", "ok");
      log("Bersih-bersih: " + (m0 - state.custom.length) + " entri dihapus dari penyimpanan.");
      break;
    }

    case "pick-scheme":
      state.genScheme = id;
      saveState();
      renderPickers();
      setStatus("Harmoni: " + (SCHEMES[id] || {}).label);
      break;

    case "pick-tone":
      state.genTone = id;
      saveState();
      renderPickers();
      setStatus("Nada: " + (id === "light" ? "terang" : "gelap"));
      break;

    case "pick-preset":
      state.cover.preset = id;
      saveState();
      renderPickers();
      setStatus("Kanvas: " + (PRESETS[id] || {}).label);
      break;

    case "toggle-fill":
      state.cover.fill = !state.cover.fill;
      saveState();
      renderPickers();
      setStatus(state.cover.fill ? "Latar akan diisi warna dasar." : "Latar dibiarkan apa adanya.");
      break;

    case "toggle-pick":
      state.fontPick = (state.fontPick === id) ? null : id;
      state.fontQuery = "";
      renderFontPickers();
      break;

    case "pick-family":
      setOverride(id, el.getAttribute("data-name"));
      break;

    case "clear-override":
      setOverride(id, null);
      break;

    case "selftest":
      runSelfTest();
      break;

    case "toggle-fold": {
      var bodyEl = document.getElementById(el.getAttribute("data-fold"));
      if (bodyEl) bodyEl.classList.toggle("is-open");
      break;
    }

    case "load-fonts":
      setStatus("Membaca font…");
      PS.loadFonts().then(function (res) {
        state.fonts = res;
        state.fonts.loaded = true;
        renderAll();
        setStatus(res.ok ? res.famCount + " keluarga font terbaca." : "Gagal membaca font.", res.ok ? "ok" : "err");
        log(res.ok ? "Font terbaca: " + res.styleCount + " gaya dalam " + res.ms + " ms." : "!! Font gagal dibaca: " + (res.error || ""));
      });
      break;

    case "type-text":
      pickPairingById(id || currentPairing().id);
      buildCover("active");
      break;

    case "build-new":
      buildCover("new");
      break;

    case "build-active":
      buildCover("active");
      break;

    case "tint-text": {
      var col = currentPalette().colors;
      guard(PS.tintActiveText(col.accent), "Teks terpilih diwarnai " + col.accent);
      break;
    }

    case "pick-format":
      applyWrap({ format: id }); saveState(); renderWrap();
      setStatus("Format: " + WRAP_FORMATS[state.wrap.format].label);
      break;

    case "pick-paper":
      applyWrap({ paper: id }); saveState(); renderWrap();
      setStatus("Kertas: " + PAPERS[state.wrap.paper].label + " (" + PAPERS[state.wrap.paper].note + ")");
      break;

    case "pick-bleed":
      applyWrap({ bleed: id }); saveState(); renderWrap();
      setStatus("Bleed: " + BLEEDS[state.wrap.bleed].label);
      break;

    case "toggle-spine":
      applyWrap({ spine: !state.wrap.spine }); saveState(); renderWrap();
      break;

    case "build-wrap":
      buildWrap();
      break;

    case "wrap-guides": {
      if (!PS.live) { log("[demo] garis panduan butuh Photoshop."); break; }
      var gl = wrapGuideLines(wrapGeom());
      guard(PS.run("Sampul: garis panduan", function () { return PS.addGuides(gl); }),
        gl.length + " garis panduan trim/bleed ditambahkan.");
      break;
    }

    case "extract-colors":
      extractFromDocument();
      break;

    case "export-pdf":
      doExport("pdf", "sampul-liput.pdf");
      break;

    case "export-jpg":
      doExport("jpg", "sampul-liput.jpg");
      break;

    case "export-png":
      doExport("png", "sampul-liput.png");
      break;

    case "export-psd":
      doExport("psd", "sampul-liput.psd");
      break;

    case "export-thumb":
      doThumb(300);
      break;

    case "save-project": {
      if (!PS.live) { log("[demo] simpan proyek butuh Photoshop (izin berkas)."); break; }
      setStatus("Menyimpan proyek…");
      PS.saveProject(serializeProject(), "proyek-sampul.sampul.json").then(function (res) {
        if (!res) return;
        if (res.cancelled) { setStatus("Dibatalkan."); return; }
        log("Proyek disimpan: " + res.name);
        setStatus("Proyek disimpan: " + res.name, "ok");
      }, function (e) {
        log("!! Simpan proyek: " + msgOf(e));
        setStatus("Simpan proyek gagal — lihat log.", "err");
      });
      break;
    }

    case "open-project": {
      if (!PS.live) { log("[demo] buka proyek butuh Photoshop (izin berkas)."); break; }
      setStatus("Membuka proyek…");
      PS.openProject().then(function (res) {
        if (!res) { setStatus("Dibatalkan."); return; }
        var err = applyProject(res.text);
        if (err) {
          log("!! Buka proyek: " + err);
          setStatus(err, "err");
          return;
        }
        syncCoverInputs();
        log("Proyek dimuat: " + res.name);
        setStatus("Proyek dimuat: " + res.name, "ok");
      }, function (e) {
        log("!! Buka proyek: " + msgOf(e));
        setStatus("Buka proyek gagal — lihat log.", "err");
      });
      break;
    }

    default:
      break;
  }
}

/* Uji tiap jalur batchPlay dan tulis hasilnya ke log panel. */
function runSelfTest() {
  if (!PS.live) {
    log("Mode demo: uji aksi hanya bisa dijalankan di dalam Photoshop.");
    setStatus("Mode demo — tidak ada Photoshop untuk diuji.", "err");
    return;
  }
  setStatus("Menguji aksi Photoshop…");
  var preset = PRESETS[state.cover.preset] || PRESETS["6x9"];
  guard(PS.selfTest(preset).then(function (rows) {
    if (!rows || !rows.length) { log("!! Uji aksi tidak menghasilkan apa-apa."); return; }
    var bad = 0;
    rows.forEach(function (r) {
      if (!r.ok) bad++;
      log((r.ok ? "OK " : "!! ") + r.name + " — " + r.info);
    });
    setStatus(bad ? (bad + " dari " + rows.length + " uji gagal — lihat log.") : ("Semua " + rows.length + " uji lolos."), bad ? "err" : "ok");
  }));
}

function init() {
  loadState();

  /* Tidak ada <select> yang perlu diisi: harmoni, nada, dan ukuran kanvas
     dirender sebagai chip oleh renderPickers(). */

  // titik hue
  var dots = "";
  for (var i = 0; i < 12; i++) {
    var h = i * 30;
    var dotHex = oklchToHex(0.62, 0.16, h);
    dots += '<button class="hue-dot" style="background:' + dotHex + '" data-act="pick-hue" data-hex="' + dotHex +
      '" title="' + h + ' derajat ' + dotHex + '"></button>';
  }
  var dotsHost = $("#genHues");
  if (dotsHost) dotsHost.innerHTML = dots;

  syncCoverInputs();
  renderAll();

  var psState = $("#psState");
  if (psState) {
    psState.textContent = PS.live
      ? "Photoshop terhubung."
      : "Mode demo (browser): aksi Photoshop dinonaktifkan.";
  }

  if (PS.live) {
    PS.loadFonts().then(function (res) {
      state.fonts = res;
      state.fonts.loaded = true;
      renderAll();
      log(res.ok ? "Font terbaca: " + res.styleCount + " gaya / " + res.famCount + " keluarga (" + res.ms + " ms)."
                 : "!! Font gagal dibaca: " + (res.error || ""));
    });
  } else {
    log("Mode demo: buka panel ini di Photoshop untuk aksi nyata.");
  }

  // klik global (delegasi)
  document.addEventListener("click", function (ev) {
    var el = ev.target;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute("data-act")) break;
      el = el.parentNode;
    }
    if (!el || el === document.body) return;
    handleAction(el.getAttribute("data-act"), el);
  });

  // tab
  var tabs = $("#tabs");
  if (tabs) tabs.addEventListener("click", function (ev) {
    var t = ev.target;
    while (t && t !== this) {
      if (t.getAttribute && t.getAttribute("data-tab")) {
        setTab(t.getAttribute("data-tab"));
        return;
      }
      t = t.parentNode;
    }
  });

  // input sampul
  function bindCoverInput(elId, key) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener("input", function () {
      state.cover[key] = el.value;
      renderCoverStage();
      if (key === "title") { renderPairingHero(); renderPairingList(); }
      saveState();
    });
  }
  bindCoverInput("fTitle", "title");
  bindCoverInput("fSubtitle", "subtitle");
  bindCoverInput("fAuthor", "author");

  // input liput penuh: halaman mengubah geometri, yang lain hanya teks
  function bindWrapInput(elId, key, reRender) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.addEventListener("input", function () {
      var patch = {};
      patch[key] = el.value;
      applyWrap(patch);
      if (reRender) renderWrap();
      saveState();
    });
  }
  bindWrapInput("fPages", "pages", true);
  bindWrapInput("fPublisher", "publisher", false);
  bindWrapInput("fBlurb", "blurb", false);
  bindWrapInput("fIsbn", "isbn", false);

  var hexIn = $("#genHex");
  if (hexIn) {
    hexIn.addEventListener("input", function () {
      var v = normHex(hexIn.value);
      if (v) state.genHex = v;
    });
  }

  // lebar panel berubah → skala pratinjau
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCoverStage, 120);
  });

  setStatus("Siap. Pilih kategori, lalu rasa yang dituju.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/* Pegang debug kecil untuk konsol UXP Developer Tool, misalnya:
     SAMPUL.state.custom.length
     SAMPUL.ps.selfTest(SAMPUL.PRESETS["a5"]).then(console.log)
   Tidak dipakai kode panel sendiri. */
try {
  window.SAMPUL = { state: state, PS: PS, PALETTES: PALETTES, PAIRINGS: PAIRINGS, PRESETS: PRESETS,
                    render: renderAll, renderAll: renderAll, save: saveState };
} catch (e) { /* window tidak ada */ }
