# Sistem Terintegrasi Prakiraan Cuaca BMKG
**Mata Kuliah:** Teknologi Sistem Terintegrasi (Semester 7)  
**Database:** `db_sistem_terintegrasi` (MySQL)  
**Sumber Data:** API Terbuka BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)

---

## 📌 Deskripsi Proyek
Aplikasi web ini dibangun untuk mengintegrasikan data cuaca publik dari **API BMKG** dengan basis data relasional lokal **MySQL (`db_sistem_terintegrasi`)** khusus untuk ruang lingkup **Provinsi Aceh**. Tampilan antarmuka didesain **sama persis seperti situs web resmi BMKG (bmkg.go.id / cuaca.bmkg.go.id)** dengan identitas visual resmi BMKG (warna navy & biru BMKG, topbar utility, header logo BMKG, running text peringatan dini, widget cuaca hero BMKG, slider prakiraan cuaca per 3 jam, grafik fluktuasi suhu/kelembapan, serta footer 4 kolom resmi).

### 📍 Cakupan Wilayah (Provinsi Aceh):
* **Kota Lhokseumawe** (Kec. Banda Sakti, Muara Dua, Blang Mangat, Muara Satu)
* **Kota Banda Aceh** (Kec. Baiturrahman, Kuta Alam)
* **Kabupaten Aceh Utara** (Kec. Lhoksukon, Dewantara, Syamtalira Bayu)
* **Kabupaten Aceh Besar** (Kec. Ingin Jaya, Darul Imarah)
* **Kabupaten Bireuen** (Kec. Kota Juang)
* **Kabupaten Aceh Tengah** (Kec. Lut Tawar / Takengon)
* **Kabupaten Aceh Barat** (Kec. Johan Pahlawan / Meulaboh)
* **Kabupaten Pidie** dan kabupaten lainnya di Aceh yang dapat ditambahkan sewaktu-waktu.

---

## 🏗️ Arsitektur Sistem Terintegrasi
```
┌─────────────────────────────────┐
│     API Terbuka BMKG (ADM4)     │
│  https://api.bmkg.go.id/publik/ │
└────────────────┬────────────────┘
                 │ HTTP GET JSON (Prakiraan 3 Hari)
                 ▼
┌─────────────────────────────────┐
│     Backend Integrator PHP      │
│   cURL Client, Parser & Normalizer
└───────┬─────────────────▲───────┘
        │                 │
        │ Query & Sync    │ REST Endpoints
        ▼                 │
┌─────────────────────────┴───────┐       ┌─────────────────────────┐
│      MySQL Database Server      │       │     Frontend Klien      │
│    (db_sistem_terintegrasi)     │◄─────►│    Dashboard & Chart    │
│  - kabupaten_kota               │       │ (Vanilla CSS, JS, Chart)│
│  - kecamatan                    │       └─────────────────────────┘
│  - kelurahan_desa (kode_adm4)   │
│  - data_cuaca                   │
└─────────────────────────────────┘
```

---

## 🗄️ Struktur Database (`db_sistem_terintegrasi`)

### 1. Tabel `kabupaten_kota`
* `id` (INT, Primary Key, AUTO_INCREMENT)
* `nama_kabupaten` (VARCHAR(100))

### 2. Tabel `kecamatan`
* `id` (INT, Primary Key, AUTO_INCREMENT)
* `kabupaten_id` (INT, Foreign Key &rarr; `kabupaten_kota.id`)
* `nama_kecamatan` (VARCHAR(100))

### 3. Tabel `kelurahan_desa`
* `id` (INT, Primary Key, AUTO_INCREMENT)
* `kecamatan_id` (INT, Foreign Key &rarr; `kecamatan.id`)
* `nama_kelurahan` (VARCHAR(100))
* `kode_adm4` (VARCHAR(20)) &mdash; *Kode Wilayah Kemendagri / BMKG*

### 4. Tabel `data_cuaca`
* `id` (INT, Primary Key, AUTO_INCREMENT)
* `kelurahan_id` (INT, Foreign Key &rarr; `kelurahan_desa.id`)
* `kondisi_cuaca` (VARCHAR(100))
* `suhu` (DECIMAL(4,1))
* `kelembapan` (INT)
* `kecepatan_angin` (VARCHAR(20))
* `arah_angin` (VARCHAR(20))
* `icon_cuaca` (VARCHAR(255))
* `tanggal_update` (DATETIME)

---

## 🚀 Fitur Utama

1. **Dashboard Cuaca Interaktif**:
   * Filter wilayah berjenjang (*Cascading Dropdown*): Kabupaten &rarr; Kecamatan &rarr; Kelurahan.
   * Kartu Hero Cuaca: Suhu saat ini, ikon resmi BMKG, deskripsi kondisi cuaca, koordinat, dan status sinkronisasi database.
   * Grafik Tren Suhu & Kelembapan 48 Jam (*Chart.js*).
   * Prakiraan cuaca per 3 jam (*Hourly Scroll*).
   * Ringkasan prakiraan 3 hari ke depan (*Daily Forecast*).
   * Inspeksi Raw JSON payload langsung di halaman.

2. **Sinkronisasi Database Otomatis & Manual**:
   * Tombol **"Sinkronkan ke Database"** untuk menyimpan cuaca wilayah aktif ke tabel `data_cuaca`.
   * Tombol **"Sinkronkan Semua Wilayah"** (*Batch Sync*) untuk memperbarui semua kelurahan sekaligus.

3. **Database & Riwayat Log Cuaca**:
   * Counter statistik agregat (Total log tersimpan, rata-rata suhu, rata-rata kelembapan, update terakhir).
   * Tabel riwayat cuaca dengan pencarian instan (*live search*).
   * Tombol sinkron ulang per baris data dan tombol hapus record.
   * Ekspor data ke format **CSV Excel**.

4. **Manajemen Master Data Wilayah**:
   * Tambah & Hapus Kabupaten/Kota.
   * Tambah & Hapus Kecamatan.
   * Tambah & Hapus Kelurahan beserta Kode ADM4 BMKG.

5. **Katalog REST API & Testing Console**:
   * Konsol interaktif untuk menguji respon JSON endpoint secara langsung tanpa aplikasi pihak ketiga (seperti Postman).

---

## 📡 Dokumentasi Endpoint REST API

| Endpoint | Method | Parameter | Keterangan |
| :--- | :---: | :--- | :--- |
| `/api/cuaca.php` | `GET` | `kelurahan_id` atau `adm4` | Mengambil data cuaca live BMKG dan status record database |
| `/api/sync.php` | `POST` / `GET` | `kelurahan_id` atau `sync_all=true` | Menjalankan sinkronisasi data BMKG ke tabel `data_cuaca` |
| `/api/wilayah.php` | `GET` | `type=tree`, `kabupaten`, `kecamatan`, `kelurahan` | Mengambil data hierarki wilayah berjenjang |
| `/api/wilayah.php` | `POST` | `action=add_kabupaten` / `add_kecamatan` / `add_kelurahan` | Menambahkan data master wilayah baru |
| `/api/wilayah.php` | `DELETE` | `type=...&id=...` | Menghapus wilayah |
| `/api/history.php` | `GET` | `search`, `limit`, `format=csv` | Mengambil riwayat log data cuaca tersimpan |
| `/api/history.php` | `DELETE` | `id=...` atau `action=clear_all` | Menghapus record riwayat cuaca |

---

## 💻 Cara Menjalankan Aplikasi

Aplikasi telah terhubung ke Laragon / Apache lokal:
1. Pastikan **MySQL** dan **Apache** di Laragon aktif.
2. Buka browser dan akses salah satu alamat berikut:
   * **`http://localhost/cuaca/`**
   * atau **`http://cuaca.test/`**
3. Jika ingin menggunakan PHP Built-in Server:
   ```bash
   cd "d:\1 tugas kuliah\07_Semester 7\Teknologi Sistem Terintegrasi\Cuaca"
   php -S localhost:8000
   ```
   Lalu buka `http://localhost:8000` di browser.
