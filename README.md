# Sampul — palet & tipografi untuk sampul buku

Plugin panel Adobe Photoshop (UXP) untuk menjawab satu masalah: **bingung memilih kombinasi warna dan font saat merancang sampul.**

Alurnya sederhana: pilih **kategori** (sastra, thriller, anak, …) dan **rasa** yang dituju (elegan, tegas, hangat, …). Plugin langsung menyodorkan palet 5 peran warna + pasangan font, lengkap dengan alasan dan angka kontras — bukan sekadar daftar acak.

## Status pemasangan (21 Nov 2026)

Sudah terpasang dan aktif di **Adobe Photoshop (Beta) 28.2**:

- Tersalin ke `%APPDATA%\Adobe\UXP\Plugins\External\com.99desains.sampul`
- **Developer Mode** dinyalakan (wajib untuk plugin tanpa tanda tangan Adobe). Cadangan setelan asli: `UIPrefs.psp.bak-sampul` di `...\Adobe Photoshop (Beta) Settings\`
- `manifest.json` memakai `"host": { "app": "PS", ... }` — UXP 10 menolak bentuk array (`Expected the host attribute to be an object`)
- Log UXP tidak melaporkan error untuk plugin ini

Membuka panel: menu **Plugins → Sampul** (kalau tidak terlihat, restart Photoshop). Menonaktifkan Developer Mode: *Preferences → Plugins*.

Folder ini (`Documents\photoshop-sampul`) adalah **master**. Salinan yang dibaca Photoshop ada di folder External di atas; setelah mengedit master, salin ulang ke sana lalu restart Photoshop.

---

## Isi folder

| File | Fungsi |
|---|---|
| `manifest.json` | Identitas plugin (manifest v5), host Photoshop ≥ 24 |
| `index.html` | Struktur panel: 3 tab (Warna, Tipografi, Bangun) + panduan rasa |
| `styles.css` | Tampilan panel, aman untuk UXP (tanpa grid/var CSS/gap) |

Tidak ada dependency, tidak ada build step. Total ~94 KB.

---

---

## Cara memasang ulang (kalau perlu pindah komputer)

**Opsi A — UXP Developer Tool (paling praktis saat masih mengembangkan)**

1. Buka Photoshop → *Preferences → Plugins* → centang **Enable Developer Mode**.
2. Jalankan **UXP Developer Tool** → *Add Plugin* → pilih `manifest.json` di folder ini.
3. Klik **Load**. Panel muncul di *Plugins → Sampul*.

**Opsi B — pasang permanen tanpa Developer Tool**

1. Photoshop → *Preferences → Plugins* → **Enable Developer Mode**, lalu tutup Photoshop.
2. Salin seluruh folder ini ke:
   `%APPDATA%\Adobe\UXP\Plugins\External\com.99desains.sampul`
3. Buka Photoshop → *Plugins → Sampul*.

Untuk berhenti memakai: hapus foldernya dari `External`. Tidak ada yang ditulis ke sistem lain.

> Catatan: kalau panel dibuka di browser biasa, plugin berjalan dalam **mode demo** — semua tombol tetap bisa diklik, tetapi aksi Photoshop hanya dicatat di log tanpa mengubah dokumen.

---

## Cara pakai

### Tab Warna
- **Kategori** + **Rasa** → daftar palet diurutkan otomatis (kategori +3, rasa +4).
- Palet terpilih menampilkan 5 peran: **Latar (60%)**, **Blok (30%)**, **Aksen (10%)**, **Tinta**, **Redup**.
- Klik kotak warna → jadi *foreground*. Tombol **BG** → *background*. Klik kode HEX → tersalin.
- Badge kontras: `13,9:1 · AAA` = kontras tinta terhadap latar (standar WCAG). Aksen diuji dengan ambang huruf besar (≥ 3:1).
- **Perbaiki kontras** menggeser kecerahan aksen (di ruang OKLCH) sampai minimal 4,5:1, lalu menyimpannya sebagai palet turunan.
- **Buat palet sendiri** — masukkan HEX, pilih harmoni (analog, komplementer, split, triadik, monokrom) dan nada gelap/terang. 120 kombinasi yang diuji semuanya lolos ambang kontras.
- **Salin CSS** mengeluarkan variabel `--base`, `--surface`, `--accent`, `--ink`, `--muted`.

### Tab Tipografi
- 19 pasangan font (1 judul + 1 teks), disaring dari kategori & rasa yang sama.
- Tiap kartu menampilkan sampel judul memakai font aslinya, alasan pemilihan, dan aturan pakai (kapital, tracking, ukuran).
- Label **terpasang / belum terpasang** dibaca langsung dari daftar font Photoshop (`app.fonts`).
- **Buat teks** langsung membuat layer judul + subjudul + penulis di dokumen aktif.
- Dropdown **Ganti font judul/teks** memakai semua keluarga font yang terpasang.

### Tab Bangun
- Pratinjau sampul hidup: warna, font, tracking, dan pembungkusan baris mengikuti pilihan Anda.
- Isi judul, subjudul, penulis, dan ukuran kanvas (6×9, 5,5×8,5, A5, 5×8, atau e-book 1600×2560).
- **Bangun sampul baru** → membuat dokumen 300 dpi, mengisi latar dengan warna dasar, dan menaruh tiga layer teks pada posisi proporsional.
- **Teks ke dokumen aktif** → menambahkan judul/subjudul/penulis ke dokumen yang sedang terbuka (untuk desain yang sudah ada).
- **Aksi cepat**: foreground = latar, background = aksen, warnai teks terpilih.
- Log di bawah mencatat setiap aksi dan pesan error bila ada.

---

## Cara kerja rekomendasinya

- **5 peran warna**, bukan 5 warna setara. Ini yang membuat sampul terasa "jadi": latar dominan, blok pendukung, aksen kecil.
- **Kontras dihitung, bukan dikira-kira.** Rasio WCAG dihitung dari luminans relatif; judul pada sampul diperlakukan sebagai huruf besar (ambang 3:1), teks kecil 4,5:1.
- **Generator memakai OKLCH**, bukan HSL. Kecerahan terasa lebih merata antar-hue, dan chroma dipangkas otomatis bila warna keluar dari gamut sRGB.
- **Alasan ditulis, bukan hanya hasil.** Setiap palet dan pasangan font punya catatan kenapa terasa begitu (mis. "kapital sempit nyaris setinggi blok: judul terasa mendesak") supaya lama-lama tidak perlu plugin lagi.
- **Font selalu punya rantai fallback.** Setiap pasangan mencantumkan kandidat PostScript (Google Fonts → Adobe Fonts → font bawaan Windows), lalu plugin memilih yang benar-benar terpasang.

---

## Catatan font

- Font Google Fonts (Playfair Display, Bebas Neue, Baloo 2, dst.) **tidak** ikut dalam plugin. Pasang lewat Adobe Fonts, atau unduh dari Google Fonts lalu instal seperti font biasa.
- Kalau font belum terpasang, Photoshop memakai fallback (Georgia, Segoe UI, Impact, Bahnschrift) — sampul tetap terbentuk, tapi rasa bisa bergeser. Label di kartu font memberi tahu kondisi ini sebelum Anda menekan **Buat teks**.
- Font yang diaktifkan lewat Adobe Fonts akan muncul di daftar Photoshop dan otomatis terdeteksi plugin.

---

## Menambah palet atau pasangan font sendiri

Semua data ada di bagian atas `main.js`.

```js
{ id: "kopi-susu", name: "Kopi Susu", genres: ["nonfiksi"], feels: ["hangat", "minimal"],
  colors: { base: "#F6EFE6", surface: "#E7D8C6", accent: "#8C5A3C", ink: "#231A14", muted: "#6E6156" },
  note: "Cokelat susu di atas kertas gading: hangat, akrab, tidak berteriak." }
```

Untuk pasangan font, tambahkan objek dengan `heading` + `body` (lihat entri yang sudah ada): `family`, `aliases`, `boldPS`/`regularPS` (kandidat nama PostScript), `css` (rantai fallback untuk pratinjau), `case`, `tracking`, ditambah `genres`, `feels`, `why`, `usage`.

---

## Kalau ada yang tidak jalan

| Gejala | Penyebab & solusi |
|---|---|
| Panel tidak muncul di menu Plugins | Developer Mode belum aktif, atau folder salah (harus `...\UXP\Plugins\External\<nama-folder>`), lalu Photoshop di-restart |
| "app.fonts tidak tersedia" | Versi Photoshop terlalu lama; pasangan font tetap jalan dengan nama PostScript cadangan |
| Font tidak berubah di layer teks | Font belum terpasang → cek label di kartu font, atau pakai dropdown **Ganti font** |
| Teks muncul di tengah kanvas | Posisi dihitung dari *bounds* layer; bila Photoshop menolak perintah geser, teks tetap di tengah — geser manual sekali, lalu pakai **Teks ke dokumen aktif** |
| Pesan error saat membangun sampul | Buka tab **Bangun** dan baca log: nama perintah yang gagal ikut dicatat |
| `Expected the host attribute to be an object` di log UXP | UXP 10+ minta `host` berupa objek, bukan array — lihat `manifest.json` sekarang |

Aksi Photoshop memakai `batchPlay` standar (`make textLayer`, `solidColorLayer`, `set color`, `move offset`). Semua panggilan dibungkus `try/catch`, jadi kegagalan satu aksi tidak mematikan panel.

---

## Versi

**1.0.0** — 28 palet kurasi, 19 pasangan font, 10 kategori, 10 rasa, generator OKLCH, uji kontras WCAG, pratinjau sampul hidup, dan 5 aksi Photoshop (set FG/BG, bangun sampul baru, tambah teks ke dokumen aktif, warnai teks terpilih, salin CSS/HEX).
