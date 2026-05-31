# Generasi Prosedural Peta Spasial Vektor 2D dan Animasi Navigasi Kendaraan Dinamis

**Mata Kuliah:** INF11114 — Grafika Komputer, Semester Genap 2025/2026  
**Program Studi:** Teknik Informatika — Fakultas Teknik dan Teknologi Kemaritiman  
**Institusi:** Universitas Maritim Raja Ali Haji (UMRAH)  
**Dosen Pengampu:** Tekad Matulatan & Nolan Efranda  
**Teknologi:** Vanilla JavaScript · HTML5 Canvas 2D · CSS3

---

## Anggota Tim

| No | Nama | NIM | Peran | Modul |
|----|------|-----|-------|-------|
| 1 | Ardiansyah Rizki Khairi Ali | 2401020044 | Ketua Tim — Transformasi & Kamera | `app.js` |
| 2 | Ikhbal Maulana | 2401020039 | Rendering & UI | `app.js`, `style.css`, `index.html` |
| 3 | Rydhoi Trimaniel Lase | 2401020061 | Animasi & Navigasi | `tracker.js` |
| 4 | Riki Andika Saputra | 2401020134 | Generasi Peta | `generator.js`, `traffic.js` |

---

## Abstrak

Proyek ini mengimplementasikan sistem generasi peta kota dua dimensi secara prosedural menggunakan teknik-teknik grafika komputer. Representasi vektor berbasis kurva Bézier dipilih agar kualitas rendering jalan tetap tajam pada semua level zoom tanpa degradasi (*jigged/pixelated*). Jaringan jalan dibangun menggunakan algoritma graf (*Gabriel Graph* + *Minimum Spanning Tree*) yang menjamin konektivitas penuh — tidak ada ruas jalan yang terisolasi. Navigasi kendaraan menggunakan algoritma Dijkstra untuk jalur terpendek, sementara animasi menggunakan *arc-length parameterization* agar kecepatan dan orientasi kendaraan selalu sinkron dengan bentuk kurva jalan. Seluruh implementasi grafis dilakukan dari prinsip dasar tanpa pustaka grafis tingkat tinggi, sesuai ketentuan RPM INF11114.

---

## Latar Belakang

Sistem peta perkotaan digital memerlukan kemampuan merender geometri jalan dengan kualitas tinggi pada berbagai skala zoom, animasi pergerakan objek yang realistis, serta kapasitas menghasilkan tata kota yang logis dan terhubung penuh. Representasi vektor merupakan pilihan tepat karena tidak bergantung pada resolusi — kurva Bézier mampu merender jalan berkelok dan diagonal dengan hasil yang tetap tajam di semua level zoom, berbeda dengan representasi raster yang mengalami degradasi kualitas saat diperbesar.

---

## Fitur yang Diimplementasikan

### Fitur Wajib (RPM INF11114)

| No | Fitur | Deskripsi | Teknik Grafika |
|----|-------|-----------|----------------|
| 1 | **Acak Map** | Mengacak ulang seluruh tata jalan secara prosedural; semua jalan terhubung, ≥90% berbentuk kurva | Gabriel Graph + MST; Kurva Bézier |
| 2 | **Acak Posisi** | Mengacak titik asal (merah) dan tujuan (hijau) tanpa mereset peta | Random node selection pada graf |
| 3 | **Zoom In / Out** | Zoom berpusat pada posisi kursor; kualitas jalan tetap tajam karena re-render dari data vektor | Transformasi affine scaling |
| 4 | **Scroll / Pan** | Menggeser pandangan peta ke segala arah via drag mouse | Transformasi affine translation |
| 5 | **Start / Pause Track** | Memulai dan menjeda animasi kendaraan; orientasi selalu sinkron dengan arah jalan | Dijkstra + arc-length parameterization + rotasi affine |

### Fitur Tambahan

| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | **Highlight Rute** | Jalur terpendek ditampilkan dengan warna hijau sebelum dan selama animasi |
| 2 | **Info Panel** | Menampilkan panjang rute, estimasi waktu, jumlah node, dan FPS secara real-time |
| 3 | **Kecepatan Kendaraan** | Slider untuk mengatur kecepatan animasi secara real-time |
| 4 | **Penanda Bangunan** | Blok bangunan/area kota (taman, gedung, danau, parkir, dll.) digambar di ruang antar jalan |
| 5 | **6 Jenis Kendaraan** | Mobil, Truk, Bus, Motor, Sepeda, Pejalan Kaki — ukuran dan kecepatan berbeda |
| 6 | **Simulasi Lalu Lintas NPC** | 90 kendaraan otonom bergerak paralel di seluruh jaringan jalan |
| 7 | **Gedung 3D Isometrik** | Ekstrusi pseudo-3D dengan face shading dan dekorasi atap animasi |
| 8 | **Minimap** | Peta mini real-time di pojok kanan bawah |
| 9 | **Tombol Zoom ＋/－** | Tombol zoom yang dapat diklik selain scroll mouse |

---

## Struktur File & Pembagian Tugas

```
├── index.html      — Struktur UI: canvas, panel kontrol, minimap, legenda     [Ikhbal]
├── style.css       — Styling panel, tombol, slider, toggle, zoom button        [Ikhbal]
├── generator.js    — CityGenerator: Gabriel Graph, MST, Bézier, Face Extract   [Riki]
├── tracker.js      — TrackerManager: Dijkstra, arc-length, animasi kendaraan   [Rydhoi]
├── traffic.js      — TrafficManager: kendaraan NPC otonom paralel              [Riki]
├── app.js          — Render loop, kamera affine, gedung 3D, culling, minimap   [Ardiansyah & Ikhbal]
└── README.md       — Dokumentasi proyek
```

---

## Rencana Teknik Grafika Komputer

### 1. Kurva Bézier Kuadratik — Rendering Jalan
`generator.js`, `app.js`

Seluruh ruas jalan direpresentasikan sebagai kurva Bézier dengan *control point* yang di-offset tegak lurus terhadap segmen:

```
B(t) = (1-t)²P₀ + 2(1-t)t·P₁ + t²P₂,   t ∈ [0, 1]
```

*Control point* P₁ dihitung otomatis sehingga jalan tampak melengkung alami. Jalan dirender ulang dari data matematis setiap frame — tidak pernah *pixelated* pada zoom berapapun.

```javascript
// Offset CP tegak lurus segmen
const offset = (Math.random() - 0.5) * len * factor;
cp = { x: midpoint.x + normalX * offset,
       y: midpoint.y + normalY * offset };
// Rendering
ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
```

### 2. Generasi Peta Prosedural — Gabriel Graph + MST
`generator.js`

**Tahap 1 — Gabriel Graph:** Node persimpangan ditempatkan acak dengan jarak minimum. Dua node `a` dan `b` dihubungkan jika tidak ada node lain `c` di dalam lingkaran berdiameter segmen `ab`:

```
radius² = ((a.x - b.x)² + (a.y - b.y)²) / 4
Edge valid: ∀c ≠ a,b → dist(c, midpoint)² ≥ radius²
```

**Tahap 2 — MST Konektivitas (Kruskal + Union-Find):** Komponen yang terpisah disambung secara greedy berdasarkan jarak terdekat, menjamin seluruh simpul terhubung. Validasi akhir dengan BFS dari sembarang simpul harus mengunjungi semua simpul.

### 3. Transformasi Affine — Zoom & Scroll
`app.js`

Sistem koordinat dibagi menjadi *World Space* (koordinat peta) dan *Screen Space* (piksel layar). Saat zoom, transformasi dilakukan berpusat pada posisi kursor:

```
T(cursor) · S(scale) · T(-cursor)
```

```javascript
ctx.scale(camera.zoom, camera.zoom);
ctx.translate(camera.x, camera.y);
```

### 4. Dijkstra Shortest Path — Navigasi
`tracker.js`

Bobot setiap edge = panjang busur kurva Bézier (diperkirakan dengan 10 *sample point*). Priority queue min-heap digunakan untuk efisiensi O((V+E) log V).

### 5. Arc-Length Parameterization — Animasi Halus
`tracker.js`

Parameter `t` pada Bézier tidak linear terhadap jarak. *Arc-length LUT* memetakan jarak tempuh → nilai `t` yang tepat sehingga kecepatan kendaraan konstan secara visual. Orientasi dihitung dari turunan B'(t) (vektor tangent) — mencegah efek *drifting*.

### 6. Ekstrusi Isometrik Pseudo-3D
`app.js`

Footprint blok diekstrusi dengan vektor isometrik `(-0.38, -0.80)`. *Face shading* berbasis dot product arah cahaya:

```javascript
const dot = normalX * 0.707 + normalY * (-0.707);
shade = dot > 0 ? 1.0 : 0.45 + 0.3 * (1 + dot);
```

*Painter's algorithm* (sort by Y) untuk urutan render yang benar.

### 7. Viewport Culling — Optimasi Performa
`app.js`

Objek di luar area pandang di-skip sebelum digambar, menjaga render loop stabil di 60 FPS.

---

## Cara Menjalankan

1. Download atau clone repository ini
2. Buka `index.html` langsung di browser — tidak perlu server atau instalasi

### Kontrol

| Aksi | Cara |
|------|------|
| Generate kota baru | Klik **🗺️ Acak Map** |
| Pilih titik awal & tujuan | Klik langsung di peta (2 klik) |
| Pilih posisi acak | Klik **📍 Acak Posisi** |
| Mulai navigasi | Klik **▶ Start** |
| Pause / Resume | Klik **⏸ Pause** atau tekan `Spasi` |
| Zoom In / Out | Tombol **＋ / －**, scroll mouse, atau `+`/`-` keyboard |
| Geser peta | Drag pada canvas |
| Reset kamera | Klik **⊙** |

---

## Kompatibilitas

- ✅ Google Chrome 90+
- ✅ Mozilla Firefox 88+
- ✅ Microsoft Edge 90+
- ✅ Safari 15+

---

## Daftar Pustaka

- Foley, J. D., van Dam, A., Feiner, S. K., & Hughes, J. F. (1990). *Computer Graphics: Principles and Practice* (2nd ed.). Addison-Wesley.
- Shirley, P., & Marschner, S. (2009). *Fundamentals of Computer Graphics* (3rd ed.). A K Peters/CRC Press.
- De Berg, M., et al. (2008). *Computational Geometry: Algorithms and Applications* (3rd ed.). Springer.
- Cormen, T. H., et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.
- Matulatan, T. & Efranda, N. (2026). *Rencana Project Mahasiswa – INF11114 Grafika Komputer Semester Genap 2025/2026*. UMRAH.

---

© Project Computer Graphics Course 2026 – Universitas Maritim Raja Ali Haji
