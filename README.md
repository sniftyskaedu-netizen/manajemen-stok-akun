# 🚀 AccExpress Seller Hub — Manajemen Stok & Inventory Akun Digital

Aplikasi Manajemen Stok, Quick Delivery, dan Inventory Akun Digital berbasis web interaktif dengan sistem Template Pesan WhatsApp otomatis, tracking status expired, export multi-sheet Excel, serta Admin Control Hub.

---

## ✨ Fitur Utama
- **Sales Hub & Quick Access**: Pengiriman cepat stok akun digital (Email & Password, Kode Redeem/Voucher, maupun Link Akses) langsung via WhatsApp.
- **Enrollment Key Viewer (Dengan Kategori)**: Manajemen Enrollment Key, Class ID, Kategori produk, dan durasi harian otomatis.
- **Template Pesan Dinamis**: Kustomisasi template pesan WhatsApp dengan tag variabel otomatis (`{{product}}`, `{{email/link}}`, `{{password}}`, `{{duration}}`, `{{sent_date}}`, `{{expires_date}}`, `{{catatan}}`).
- **Inventory & Tracking Status**: Pemantauan stok TERSEDIA, TERKIRIM, dan EXPIRED secara otomatis dengan indikator peringatan akun yang akan expired (< 12 jam).
- **Export Multi-Sheet Excel**: Unduh seluruh data inventaris dan riwayat ke file Excel (.xlsx) rapi berdasar status dan kategori produk menggunakan SheetJS.
- **Admin Control Panel**: Keamanan berbasis PIN Admin, Activity Log, Pengaturan Produk & Template, serta statistik dashboard.

---

## ⚡ Deployment Otomatis (GitHub, Vercel & Supabase)

### 1. 🌐 Setup Vercel (Otomatis & Gratis)
1. Push repositori ini ke **GitHub**.
2. Buka [Vercel Dashboard](https://vercel.com) -> **Add New Project**.
3. Import repositori GitHub ini.
4. Pada **Framework Preset**, pilih **Other** (Web Static).
5. Klik **Deploy**. File `vercel.json` secara otomatis mengonfigurasi routing dan header keamanan.

### 2. 🤖 Setup GitHub Actions (Auto-Deploy Setiap Commit)
Agar Vercel ter-deploy secara otomatis setiap kali Anda melalukan `git push`:
1. Buat **Personal Access Token (PAT)** di Vercel: Account Settings -> Tokens -> **Create Token**.
2. Ambil `ORG_ID` dan `PROJECT_ID` dari folder `.vercel/project.json` atau URL Project Vercel.
3. Di Repositori GitHub Anda: **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:
   - `VERCEL_TOKEN` : Token Vercel Anda.
   - `VERCEL_ORG_ID` : Organization ID Vercel.
   - `VERCEL_PROJECT_ID` : Project ID Vercel.
4. Setiap push ke branch `main` atau `master` akan mentrigger workflow `.github/workflows/deploy.yml` untuk deploy otomatis.

### 3. 🗄️ Setup Database Supabase & Migrasi Skema
1. Buka [Supabase Dashboard](https://supabase.com) -> Masuk ke project Anda.
2. Buka **SQL Editor** -> **New Query**.
3. Copy isi file `supabase/schema.sql` dan jalankan (**Run**).
4. SQL Script akan otomatis membuat seluruh tabel (`accexpress_products`, `accexpress_accounts`, `accexpress_id_keys` dengan kolom `category`, dll.) beserta Kebijakan Keamanan (RLS).

---

## 🛠️ Teknologi & Arsitektur
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design System & Modern UI), JavaScript (ES Modules).
- **Icons**: Lucide Icons.
- **Backend / DB**: Supabase Database & Realtime Sync.
- **CI/CD & Hosting**: Vercel & GitHub Actions.

---

## 📄 Lisensi
MIT License — Bebas digunakan dan dikembangkan untuk operasional toko digital Anda.
