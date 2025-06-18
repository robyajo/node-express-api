# Express.js API with TypeScript, Prisma, and MySQL

API sederhana menggunakan Express.js, TypeScript, dan Prisma sebagai ORM untuk MySQL.

## Cara Menjalankan

1. Instal dependensi: `npm install`
2. Buat database MySQL dan sesuaikan `DATABASE_URL` di `.env`
3. Buat file `.env` berdasarkan contoh di atas
4. Jalankan migrasi Prisma: `npm run prisma:migrate`
5. Generate Prisma Client: `npm run prisma:generate`
6. Bangun proyek: `npm run build`
7. Jalankan server: `npm start` atau `npm run dev` (untuk pengembangan dengan ts-node-dev)

## Struktur Proyek

- `/src/config`: Konfigurasi aplikasi dan database
- `/src/controllers`: Logika bisnis
- `/src/middleware`: Middleware untuk autentikasi, validasi, dll.
- `/src/routes`: Definisi rute API
- `/src/utils`: Fungsi utilitas
- `/prisma`: Skema database Prisma

## Database

- Gunakan MySQL sebagai database.
- Prisma akan mengelola skema database melalui `schema.prisma`.
- Jalankan `prisma migrate dev` untuk membuat/memperbarui tabel.

## Catatan

- Pastikan MySQL server berjalan dan database sudah dibuat.
- Gunakan `ts-node-dev` untuk pengembangan agar server restart otomatis saat ada perubahan.
- Tambahkan middleware autentikasi pada rute yang memerlukannya.
