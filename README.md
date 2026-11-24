# Sampul — palet & tipografi untuk sampul buku

Panel **Adobe Photoshop (UXP)** untuk satu masalah: bingung memilih kombinasi warna dan font saat merancang sampul.

Alurnya: pilih **kategori** (sastra, thriller, anak, …) dan **rasa** yang dituju (elegan, tegas, hangat, …). Panel langsung menyodorkan palet 5 peran warna + pasangan font, lengkap dengan alasan dan angka kontras — bukan daftar acak — lalu bisa membangun dokumennya.

## Status pemasangan

| | |
|---|---|
| Versi | **1.3.0** (manifest v5) |
| Host teruji | Adobe Photoshop (Beta) **28.2** — UXP 10 |
| Cara aktif | disalin ke `%APPDATA%\Adobe\UXP\Plugins\External\com.99desains.sampul` + **Developer Mode** |
| Izin | `localFileSystem: "none"` (tidak sentuh disk), tanpa jaringan, tanpa dependensi |
| Ukuran | ± 110 KB (5 file + 4 ikon + 1 skrip uji) |
| Uji mandiri | `node scripts/selftest.js` → 60 pemeriksaan, tanpa Photoshop |
| Master | folder ini. Salinan terinstal dibuat ulang dengan `npm run sync` |

Membuka panel: menu **Plugins → Sampul**. Kalau tidak muncul, restart Photoshop.

---

## Isi folder

| File | Fungsi |
|---|---|
| `manifest.json` | identitas plugin, host PS ≥ 24, ikon, tanpa izin file system |
| `index.html` | struktur panel: 3 tab (Warna, Tipografi, Bangun) + panduan rasa |
| `styles.css` | tampilan panel; aman untuk UXP (tanpa grid/var CSS/gap, tanpa `<select>`) |
| `main.js` | data + logika (bagian 1–8) |
| `icons/` | `icon_D.png` / `icon_N.png` @1x @2x (20 px, RGBA) untuk menu Plugins |
| `scripts/selftest.js` | uji regresi: matematika warna, integritas data, penyimpanan, render, bentuk deskriptor batchPlay |
| `package.json` | `npm test`, `npm run check`, `npm run sync` |

Tidak ada dependensi, tidak ada build step.

---

## Memasang

**Opsi A — UXP Developer Tool (paling enak saat mengembangkan)**

1. Photoshop → *Preferences → Plugins* → centang **Enable Developer Mode**.
2. Buka **UXP Developer Tool** → *Add Plugin* → pilih `manifest.json` di folder ini.
3. **Load**. Panel muncul di *Plugins → Sampul*, dan bisa reload tanpa restart.

Catatan: kalau plugin ini juga ada di folder `External`, menu bisa muncul dua kali. Pilih salah satu jalur; untuk pengembangan, pakai Opsi A dan hapus salinan `External`.

**Opsi B — pasang permanen tanpa Developer Tool**

1. Photoshop → *Preferences → Plugins* → **Enable Developer Mode**, lalu tutup Photoshop.
2. Salin seluruh folder ini ke `%APPDATA%\Adobe\UXP\Plugins\External\com.99desains.sampul`
   (atau jalankan `npm run sync` dari folder master).
3. Buka Photoshop → *Plugins → Sampul*.

Berhenti memakai: hapus foldernya dari `External`. Developer Mode sebaiknya dimatikan lagi (Preferences → Plugins) karena mode itu juga memuat plugin tak bertanda tangan lain. Cadangan setelan asli tersimpan sebagai `UIPrefs.psp.bak-sampul` di folder setting Photoshop Beta.

> Di browser biasa panel berjalan dalam **mode demo**: semua tombol hidup, aksi Photoshop hanya dicatat di log.

---

## Cara pakai

### Tab Warna
- **Kategori** + **Rasa** → daftar palet diurutkan otomatis (kategori +3, rasa +4).
- Palet terpilih menampilkan 5 peran: **Latar (60%)**, **Blok (30%)**, **Aksen (10%)**, **Tinta**, **Redup**.
- Klik kotak warna → *foreground*. Tombol **BG** → *background*. Klik kode HEX → tersalin.
- Badge kontras: `13,9:1 · AAA` = kontras tinta terhadap latar (WCAG). Aksen diuji pada ambang huruf besar (≥ 3:1) **dan** huruf kecil (≥ 4,5:1).
- **Perbaiki kontras** menggeser kecerahan aksen di ruang OKLCH sampai ≥ 4,5:1 dan menyimpannya sebagai palet turunan. Kalau aksen sudah lolos, panel mengatakannya dan **tidak** membuat duplikat.
- **Buat palet sendiri** — masukkan HEX, lalu pilih harmoni dan nada lewat **chip** (bukan dropdown, lihat catatan UXP di bawah).
- Palet simpanan bisa dihapus satu-satu (×) atau dirapikan sekali (**Bersihkan palet simpanan**); maksimal 24, duplikat dan entri rusak dibuang otomatis.

### Tab Tipografi
- 19 pasangan font (1 judul + 1 teks), disaring dari kategori & rasa yang sama.
- Tiap kartu menampilkan sampel judul, alasan, aturan pakai, dan **keluarga font yang benar-benar akan dipakai** — kalau judul digantikan pengganti yang terpasang, tertulis `X → Y (pengganti)`.
- **Ganti font judul / Ganti font teks** = chip + kolom saring + daftar terbatas (60 baris). Pilihan tersimpan antar sesi.
- Label terpasang/belum dibaca langsung dari `app.fonts` Photoshop.

### Tab Bangun
- Pratinjau sampul hidup: warna, font, tracking, dan pembungkusan baris mengikuti pilihan; judul multi-baris benar-benar patah baris.
- Isi judul, subjudul, penulis; pilih ukuran kanvas (6×9, 5,5×8,5, A5, 5×8, e-book) lewat chip; centang **isi latar**.
- **Bangun sampul baru** → dokumen 300 dpi, latar warna dasar, tiga layer teks pada posisi proporsional. Ukuran judul dihitung dari **jumlah baris** (anggaran ±30% tinggi kanvas) dan lebar baris terpanjang.
- **Teks ke dokumen aktif** → menambah layer teks ke dokumen yang terbuka.
- **Uji aksi Photoshop** → menjalankan tiap deskriptor batchPlay satu per satu (ambil/set foreground, baca ukuran dokumen lewat AM, baca daftar font, buat + geser + tutup dokumen uji tanpa menyimpan) dan menulis hasilnya ke log. Jalankan ini sekali setelah upgrade Photoshop.
- Log mencatat setiap aksi; baris diawali `!!` berarti gagal.

---

## Cara kerja rekomendasinya

- **5 peran warna**, bukan 5 warna setara: latar dominan, blok pendukung, aksen kecil.
- **Kontras dihitung** dari luminans relatif. Ambang: judul/huruf besar ≥ 3:1, teks kecil ≥ 4,5:1 (WCAG).
- **Generator memakai OKLCH**, bukan HSL — kecerahan lebih merata antar-hue, chroma dipangkas otomatis bila keluar gamut sRGB.
- **Input netral tidak dihukum.** Untuk abu/hitam/putih (chroma ≈ 0) hue hasil konversi cuma noise float, jadi panel memilih arah hangat/terang sendiri.
- **Alasan ditulis, bukan hanya hasil**, supaya lama-lama tidak perlu panel.
- **Rantai fallback font** memuat nama yang benar-benar ada di mesin Windows/Adobe (AGaramond, Trajan, Minion, Georgia, Segoe UI, Bahnschrift), dan panel memakai yang terpasang.

### Angka hasil uji (bukan klaim lisan)
`node scripts/selftest.js` memeriksa:

- kontras `#000`/`#fff` = 21,00 dan `#767676`/`#fff` = 4,54 (tepat di ambang AA);
- OKLCH: `L=1→#FFFFFF`, `L=0→#000000`, hue merah ≈ 29°, biru ≈ 264°, roundtrip stabil, chroma 0,4 tidak menghasilkan HEX cacat;
- **4.800 kombinasi generator** (200 warna × 5 harmoni × 2 nada): 0 palet cacat, aksen terburuk **4,50:1**, tinta terburuk 14,7:1, redup terburuk 4,07:1;
- 28 palet kurasi: tinta ≥ 4,5:1 dan aksen ≥ 3:1 untuk semuanya;
- 10 rasa punya palet **dan** pasangan font (dulu "misterius" nol);
- `pruneCustom` membuang palet kembar/cacat dan membatasi 24 entri.

---

## Catatan UXP (kenapa tidak ada `<select>`)

Runtime UXP Photoshop punya daftar tag HTML terbatas dan panel bawaan Adobe memakai Spectrum Web Components (`sp-picker`, `sp-menu`) dengan `featureFlags.enableSWCSupport` — **tidak ada satu pun yang memakai `<select>`**. Supaya tidak ada kontrol yang diam-diam tidak muncul, semua pemilih (harmoni, nada, ukuran kanvas, isi latar, ganti font) dibangun dari `<button>`/`<div>` + gaya `.chip` yang sudah ada.

Kalau nanti ingin kontrol native, tambahkan `"featureFlags": { "enableSWCSupport": true }` pada manifest dan muat `sp-picker`.

---

## Catatan font

- Font Google (Playfair Display, Bebas Neue, Baloo 2, …) tidak ikut terpasang. Pasang lewat Adobe Fonts, Google Fonts, atau Font Manager lokal Anda, lalu restart Photoshop agar muncul di `app.fonts`.
- Font yang diaktifkan lewat Adobe Fonts otomatis terdeteksi panel.
- Kalau font belum terpasang, Photoshop memakai fallback (Georgia, Segoe UI, Impact, Bahnschrift) — sampul tetap jadi, rasanya bisa bergeser. Kartu font memberi tahu sebelum Anda menekan **Buat teks**.
- Mesin dengan >10.000 berkas font membuat `app.fonts` lambat; panel hanya membaca sekali per sesi dan tidak menaruh seluruh daftar ke DOM.

---

## Menambah palet atau pasangan font

Semua data ada di bagian atas `main.js`.

```js
{ id: "kopi-susu", name: "Kopi Susu", genres: ["nonfiksi"], feels: ["hangat", "minimal"],
  colors: { base: "#F6EFE6", surface: "#E7D8C6", accent: "#8C5A3C", ink: "#231A14", muted: "#6E6156" },
  note: "Cokelat susu di atas kertas gading: hangat, akrab, tidak berteriak." }
```

Untuk pasangan font: objek dengan `heading` + `body` — `family`, `aliases` (nama keluarga yang diterima, termasuk pengganti), `boldPS`/`regularPS` (kandidat nama PostScript), `css` (rantai fallback pratinjau), `case`, `tracking`, lalu `genres`, `feels`, `why`, `usage`. Setelah mengubah data, jalankan `npm test` — ia akan menegur kalau ada rujukan genre/rasa yang mati atau palet yang kontrasnya jeblok.

---

## Kalau ada yang tidak jalan

| Gejala | Penyebab & solusi |
|---|---|
| Panel tidak muncul di menu Plugins | Developer Mode belum aktif, atau folder salah (harus `…\UXP\Plugins\External\<id>`), lalu restart Photoshop |
| Menu "Sampul" muncul dua kali | plugin terdaftar di UXP Developer Tool **dan** ada di `External` — hapus salah satu |
| `app.fonts` lambat / tidak muncul | ribuan font terpasang; tekan **Baca daftar font** sekali, jangan buka tab Tipografi berulang-ulang |
| Font layer tidak berubah | font belum terpasang → pakai chip **Ganti font judul/teks** untuk memilih yang ada (pilihan kini tersimpan) |
| Teks muncul di tengah kanvas, bukan posisi | perintah `move offset` ditolak (mis. layer terkunci) — geser manual sekali, lalu pakai **Teks ke dokumen aktif** |
| Judul lebih kecil/besar dari perkiraan | lihat log: panel mencetak ukuran kanvas hasil baca AM dan pt judul yang dihitung |
| "Sampul dibuat" tapi warna/latar tidak sesuai | tekan **Uji aksi Photoshop**; baris `!!` menunjukkan deskriptor mana yang ditolak PS versi ini |
| `Expected the host attribute to be an object` | UXP 10 minta `host` objek, bukan array — sudah diperbaiki di `manifest.json` |
| Data lama tampil aneh | **Bersihkan palet simpanan**, atau hapus `%APPDATA%\Adobe\UXP\PluginsStorage\PHSPBETA\28\External\com.99desains.sampul` |

---

## Versi

**1.3.0** — perbaikan hasil audit
- *Bug*: pratinjau sampul menampilkan `<br />` sebagai teks pada judul multi-baris (escape sebelum join).
- *Bug*: **Perbaiki kontras** selalu menyimpan palet baru walaupun tidak ada yang berubah → 23 dari 28 palet kurasi hanya menumpuk duplikat di penyimpanan; kini no-op dilaporkan, dan palet simpanan bisa dihapus/dirapikan (maks 24, duplikat & entri rusak dibuang saat muat).
- *Data*: rasa **misterius** akhirnya punya pasangan font (bebas-barlow, anton-inter, spacegrotesk-inter, orbitron-rajdhani).
- *batchPlay*: `fill`/`mode`/`depth` dokumen dan `autoKern`/`justification` teks diperbaiki ke bentuk enum yang benar, `createDocument` memakai API inti lebih dulu dengan dua cadangan, `makeTextLayer` punya jalur fallback, dan ukuran dokumen dibaca lewat AM (heuristik "di bawah 200 = inci" dibuang).
- *UXP*: semua `<select>`/`<option>` diganti chip + daftar tersaring; checkbox jadi tombol toggle; daftar font tidak lagi dirender penuh.
- *Generator*: input netral tidak lagi menghasilkan hue acak; aksen dipaksa ≥ 4,5:1; redup ≥ 3:1; nama palet tidak kembar.
- *Font*: rantai `aliases`/`boldPS`/`regularPS` diperkaya dengan keluarga yang lazim terpasang, dan `override` font kini tersimpan antar sesi; label kartu menunjukkan font pengganti yang akan dipakai.
- *Packaging*: ikon panel (4 PNG), `developer.id`, izin file system dilepas, `README` disinkronkan, `package.json` + `scripts/selftest.js`, proyek masuk git.

**1.0.0** — 28 palet kurasi, 19 pasangan font, 10 kategori, 10 rasa, generator OKLCH, uji kontras WCAG, pratinjau sampul hidup, 5 aksi Photoshop.

## Yang masih direncanakan

Mode buku penuh (bleed + spine + sampul wrap preset KDP/BookBaby), ekspor PDF print-ready & thumbnail toko, palet diambil dari foto dokumen aktif, penyimpanan `.sampul.json` per proyek (butuh izin `fullAccess`), integrasi dengan Font Manager lokal, lalu paket `.ccw3` bertanda tangan supaya tidak perlu Developer Mode.
