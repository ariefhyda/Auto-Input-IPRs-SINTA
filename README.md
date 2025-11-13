# Auto Input IPRs - SINTA Chrome Extension

Ekstensi Chrome untuk auto-fill form IPR pada website SINTA menggunakan data JSON.

**By ariefhyda**

## Instalasi

1. Buka Chrome dan ketik `chrome://extensions/` di address bar
2. Aktifkan "Developer mode" (toggle di pojok kanan atas)
3. Klik "Load unpacked"
4. Pilih folder ekstensi ini
5. Ekstensi siap digunakan!

## Cara Menggunakan

### 1. Upload JSON File

1. Klik ikon ekstensi di toolbar Chrome
2. Klik tombol "Choose JSON File" untuk upload file JSON
3. Pilih file JSON yang berisi data IPR Anda
4. File akan tersimpan di storage browser dan daftar entry akan ditampilkan
5. Informasi file akan muncul di bawah tombol upload (jumlah entry)

### 2. Pilih Kategori IPR

1. Setelah upload JSON, pilih kategori IPR dari dropdown
2. Pilihan kategori yang tersedia:
   - Hak Cipta
   - Paten
   - Paten Sederhana
   - Merek
   - Indikasi Geografis
   - Desain Industri
   - Desain Tata Letak Sirkuit Terpadu
   - Rahasia Dagang
   - Perlindungan Varietas Tanaman
3. Kategori ini akan digunakan untuk semua entry yang diproses

### 3. Memulai Auto Fill

1. Buka halaman SINTA IPR:
   - Halaman list: https://sinta.kemdiktisaintek.go.id/profile/iprs
   - Halaman add: https://sinta.kemdiktisaintek.go.id/profile/ipradd
2. Klik ikon ekstensi di toolbar Chrome
3. Pastikan JSON file sudah di-upload dan kategori sudah dipilih
4. Klik tombol **"Start Auto Fill"**
5. Status akan berubah menjadi **"Running"** (hijau)
6. Progress info akan menampilkan jumlah entry yang tersisa
7. Ekstensi akan otomatis:
   - Mengisi form dengan data dari JSON
   - Klik tombol "Check IPR"
   - Menunggu response dari API
   - Mengisi field yang kosong (jika >6 field kosong)
   - Submit form
   - Redirect ke halaman list IPR
   - Klik tombol "Add IPR"
   - Mengulangi proses untuk entry berikutnya
   - Berhenti ketika semua entry selesai diproses

### 4. Menghentikan Auto Fill

1. Jika ingin menghentikan proses sebelum selesai:
   - Klik ikon ekstensi di toolbar Chrome
   - Klik tombol **"Stop"**
   - Status akan berubah menjadi **"Idle"** (biru)
   - Proses akan dihentikan setelah entry saat ini selesai
2. Setelah dihentikan, Anda bisa:
   - Melanjutkan proses dengan klik "Start Auto Fill" lagi
   - Mengubah kategori (jika diperlukan)
   - Upload JSON file baru

### 5. Menghapus Data

- Klik tombol **"Clear Data"** untuk menghapus data yang sudah di-upload
- Setelah dihapus, ekstensi akan mencoba load dari file default (pdki.json)
- Jika file default tidak ada, Anda perlu upload file JSON baru

### 6. Monitoring Progress

- **Status Indicator**: Menampilkan status "Running" atau "Idle"
- **Progress Info**: Menampilkan jumlah entry yang tersisa saat proses berjalan
- **Entry List**: Menampilkan daftar semua entry dari JSON file
- Status dan progress akan update secara real-time saat proses berjalan

## Cara Kerja

### Alur Proses Auto Fill

1. **Upload JSON**: Data JSON di-upload dan disimpan di browser storage
2. **Pilih Kategori**: User memilih kategori IPR yang akan digunakan
3. **Start Auto Fill**: User klik tombol "Start Auto Fill"
4. **Fill Form**: 
   - Ekstensi mengisi field `nomor_permohonan` dengan data dari JSON
   - Klik tombol "Check IPR" otomatis
   - Tunggu response dari API (maksimal 30 detik)
5. **Check Response**:
   - Jika banyak field yang kosong (>6), form akan diisi dengan data dari JSON
   - Jika response API sudah memiliki data, form akan dibiarkan seperti itu
6. **Submit Form**: 
   - Klik tombol "Claim IPR" otomatis
   - Tunggu redirect ke halaman list IPR
7. **Next Entry**:
   - Klik tombol "Add IPR" otomatis
   - Navigasi ke halaman add IPR
   - Entry yang sudah diproses dihapus dari data
   - Ulangi proses dari langkah 4 untuk entry berikutnya
8. **Finish**: 
   - Proses selesai ketika semua entry sudah diproses
   - Alert "All entries have been processed successfully!" akan muncul
   - Status berubah menjadi "Idle"

## Mapping Data JSON ke Form

Jika response API memiliki banyak field kosong (>6), ekstensi akan mengisi form dengan data dari JSON:

- `kategori` → Kategori yang dipilih user (dari dropdown)
- `tahun_permohonan` → Tahun dari `tanggalPermohonan` (format: YYYY)
- `pemegang_paten` → Nama dari `pemegang[0].nama`
- `inventor` → Gabungan nama dari `pencipta` (dipisah koma, contoh: "pencipta 1, pencipta 2")
- `title` → `judul`
- `status_ipr` → "Diterima"
- `no_publikasi` → `kode`
- `tgl_publikasi` → `tanggalPencatatan` (format: YYYY-MM-DD)
- `filling_date` → `tanggalPermohonan` (format: YYYY-MM-DD)
- `reception_date` → `tanggalPencatatan` (format: YYYY-MM-DD)
- `no_registrasi` → `kode`
- `tgl_registrasi` → `tanggalPencatatan` (format: YYYY-MM-DD)

### Format JSON yang Diharapkan

```json
[
  {
    "judul": "Judul IPR",
    "nomorPermohonan": "123456789",
    "kode": "CODE123",
    "pemegang": [
      {
        "nama": "Nama Pemegang"
      }
    ],
    "pencipta": [
      {
        "nama": "Pencipta 1"
      },
      {
        "nama": "Pencipta 2"
      }
    ],
    "tanggalPermohonan": "2023-01-15",
    "tanggalPencatatan": "2023-02-20"
  }
]
```

## Membuat Icons

1. Buka file `generate-icons.html` di browser
2. Klik tombol download untuk setiap icon (icon16.png, icon48.png, icon128.png)
3. Simpan icon-icon tersebut di folder ekstensi

## Fitur

### Fitur Utama

- **Upload JSON File**: Upload file JSON melalui popup ekstensi
- **Pilih Kategori IPR**: Pilih kategori IPR dari dropdown (9 pilihan)
- **Auto Fill Batch**: Proses semua entry secara otomatis tanpa intervensi manual
- **Start/Stop Control**: Kontrol proses dengan tombol Start dan Stop
- **Status Indicator**: Indikator status real-time (Running/Idle)
- **Progress Info**: Informasi progress jumlah entry yang tersisa
- **Storage**: Data JSON tersimpan di browser storage dan akan digunakan setiap kali popup dibuka
- **Auto Load**: Ekstensi akan otomatis load data dari storage, atau dari file default (pdki.json) jika tidak ada data di storage
- **Clear Data**: Hapus data yang sudah di-upload dan kembali ke file default
- **Validasi**: Validasi format JSON dan struktur data sebelum digunakan

### Fitur Tambahan

- **Auto Navigation**: Navigasi otomatis antara halaman list dan add IPR
- **Auto Submit**: Submit form otomatis setelah data terisi
- **Auto Retry**: Retry otomatis jika form belum siap
- **Error Handling**: Penanganan error yang baik dengan logging
- **Stop Support**: Dapat menghentikan proses kapan saja
- **Real-time Updates**: Update status dan progress secara real-time

## Catatan Penting

- **File JSON**: Harus berupa array of objects dengan struktur yang sesuai
- **Halaman SINTA**: Extension hanya bekerja di halaman SINTA IPR (iprs dan ipradd)
- **Browser Storage**: Data yang di-upload akan tersimpan di browser storage (local storage)
- **Icons**: Jika icons belum dibuat, ekstensi masih bisa digunakan namun tidak akan menampilkan icon di toolbar
- **File Default**: File default (pdki.json) hanya digunakan jika tidak ada data di storage
- **Kategori**: Kategori yang dipilih akan digunakan untuk semua entry yang diproses
- **Stop Process**: Proses dapat dihentikan kapan saja dengan klik tombol "Stop"
- **Error Handling**: Jika terjadi error, proses akan berhenti dan error akan di-log di console

## Troubleshooting

### Problem: "No entries found. Please upload JSON file first."
- **Solusi**: Upload file JSON terlebih dahulu melalui tombol "Choose JSON File"

### Problem: "Please navigate to SINTA IPR page first"
- **Solusi**: Buka halaman SINTA IPR (https://sinta.kemdiktisaintek.go.id/profile/iprs atau /profile/ipradd) terlebih dahulu

### Problem: "Please select a kategori first"
- **Solusi**: Pilih kategori IPR dari dropdown sebelum klik "Start Auto Fill"

### Problem: Proses berhenti di tengah jalan
- **Solusi**: 
  - Check console browser untuk melihat error
  - Pastikan halaman SINTA tidak mengalami error
  - Pastikan koneksi internet stabil
  - Coba klik "Start Auto Fill" lagi

### Problem: Form tidak terisi
- **Solusi**:
  - Pastikan format JSON sudah benar
  - Pastikan field yang diperlukan ada di JSON
  - Check console browser untuk melihat error

## Kontak

**By ariefhyda**

Untuk pertanyaan atau masalah, silakan hubungi developer.

