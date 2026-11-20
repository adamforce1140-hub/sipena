# SIPENA

Sistem manajemen NPF (Non-Per Instalment Financing) internal.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Prisma + PostgreSQL (Supabase session pooler)
- NextAuth v5 (Credentials + JWT session)
- `@react-pdf/renderer` + PDFKit untuk PDF, `xlsx` untuk Excel
- Zod untuk validasi input

## Menjalankan secara lokal

```bash
npm install
npm run prisma:generate
npm run db:push     # atau npm run db:migrate
npm run dev
```

Buka http://localhost:3000

## Variabel environment

Buat file `.env` (lihat `.env.example`):

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL/Supabase |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Kunci enkripsi session |
| `AUTH_TRUST_HOST` | `true` saat berjalan di belakang reverse proxy |
| `CRON_SECRET` | Token endpoint cron jobs |
| `DB_POOL_MAX` | Batas koneksi database per instance (isi `1` di serverless) |
| `STORAGE_DIR` | Lokasi penyimpanan bukti (default `storage/uploads`) |

## Akun awal

Seed membuat dua akun:

- `staff@npf.local` / `password123`
- `supervisor@npf.local` / `password123`

Ganti password default sebelum dipakai di lingkungan internal.
