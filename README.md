# LensaScan — Pemindai Dokumen Web ala CamScanner

Aplikasi pemindai dokumen berbasis web (*client-side*, PWA-ready) dengan nuansa antarmuka iOS/iPhone yang juga adaptif untuk desktop. Semua pemrosesan gambar, koreksi perspektif, OCR, dan penyimpanan dilakukan langsung di browser tanpa perlu mengunggah dokumen sensitif ke server eksternal.

## Fitur Utama

- **Kamera Langsung & Impor Galeri**: Ambil foto dokumen satu per satu atau sekaligus (*batch mode*) menggunakan kamera perangkat (`getUserMedia`), unggah banyak foto dari galeri, atau langsung coba lewat **Dokumen Contoh** bawaan.
- **Deteksi Tepi & Crop Perspektif 4 Titik**: Algoritma otomatis mendeteksi 4 sudut kertas di atas meja, dilengkapi *handle* sentuh/mouse dan **kaca pembesar (Magnifier Loupe)** seperti iPhone untuk presisi piksel, lalu meluruskan dokumen miring dengan matriks homografi proyektif 3×3 + interpolasi bilinear.
- **Filter Peningkatan Dokumen**: Pilihan preset **Magic Color** (memutihkan latar kertas & menghilangkan bayangan tidak merata sambil menjaga warna tanda tangan/logo), **Asli**, **Abu-abu**, dan **Hitam Putih**, plus slider **Kecerahan** dan **Kontras**.
- **Dokumen Multi-Halaman & Penyimpanan Lokal**: Kelola banyak halaman dalam satu dokumen (tambah halaman, ubah urutan, putar 90°, edit ulang potongan/filter, pindah folder, pencarian) yang tersimpan otomatis di **IndexedDB**.
- **Ekspor PDF, JPG, PNG & Share**: Gabungkan semua halaman menjadi 1 berkas PDF (`A4`, `Auto`, atau `Letter`), unduh sebagai gambar JPG/PNG, atau bagikan langsung lewat Web Share API.
- **OCR (Ekstraksi Teks Otomatis)**: Membaca teks dari hasil scan menggunakan **Tesseract.js** (mendukung Bahasa Indonesia + Inggris), bisa diedit, disalin ke clipboard, atau diunduh sebagai `.txt`.

## Menjalankan Project

```bash
npm install
npm run dev
```

Untuk build produksi:

```bash
npm run build
npm run preview
```
