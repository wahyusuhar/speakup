# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repo ini.

## Proyek

**SpeakUp** — aplikasi Android (Expo + React Native + TypeScript) untuk belajar bahasa Inggris dengan AI guru privat. Fitur inti adalah **telepon suara realtime** dengan guru melalui Gemini Live API. Dipakai pribadi, local-first, **tanpa biaya sama sekali**.

Baca sebelum mengerjakan apa pun:
- `PRD.md` — apa yang dibangun dan kriteria diterima.
- `ARCHITECTURE.md` — stack, struktur folder, alur telepon, skema DB.
- `PROMPTS.md` — semua prompt AI dan JSON schema.
- `ROADMAP.md` — urutan tugas. Kerjakan tugas yang diminta saja, lalu centang di sini.

## Aturan Wajib

1. **Rp0.** Jangan menambah layanan, SDK, atau dependency yang butuh billing/kartu kredit. Hanya free tier Gemini API (Google AI Studio) dan paket open source.
2. **Jangan menebak API Gemini Live.** Nama model, nama field `setup`, dan format pesan sering berubah. Sebelum menulis/mengubah kode di `src/live/`, cek dokumentasi resmi terbaru (https://ai.google.dev/gemini-api/docs/live-api dan referensi API). Jika tidak bisa memastikan, tanya dulu.
3. **Nama model hanya di `src/config/models.ts`.** Jangan hardcode nama model di tempat lain.
4. **API key tidak boleh masuk repo.** Disimpan di `expo-secure-store`, diinput pengguna lewat UI. Jangan buat `.env` berisi key. Jangan log key.
5. **Audio tidak disimpan.** Hanya transkrip teks yang masuk database.
6. **Prompt sinkron dengan `PROMPTS.md`.** Jika mengubah prompt di `src/prompts/`, perbarui `PROMPTS.md` juga.
7. **Semua kode Live API di `src/live/`, semua kode audio di `src/audio/`.** UI tidak boleh berbicara langsung dengan WebSocket.
8. **UI berbahasa Indonesia.** Kode, nama variabel, dan komentar dalam bahasa Inggris.

## Perintah

```bash
npm install
npx expo run:android          # build & pasang dev build ke HP (USB debugging)
npx expo start --dev-client   # jalankan Metro untuk dev build
npm test                      # Jest
npx tsc --noEmit              # cek tipe
npx expo lint                 # lint
```

Proyek memakai **development build**, bukan Expo Go (library audio memakai kode native). Build lokal, bukan EAS cloud.

## Gaya Kode

- TypeScript `strict`. Hindari `any`; pakai `unknown` + validasi (`zod`) untuk data dari jaringan dan dari model AI.
- Komponen fungsional + hooks. State global di `zustand`, state lokal di komponen.
- Fungsi murni untuk konversi audio dan builder prompt, sehingga bisa diuji dengan Jest.
- Hasil model teks selalu divalidasi sebelum disimpan ke DB.
- Perubahan skema DB = migrasi baru (naikkan `PRAGMA user_version`), jangan ubah migrasi lama.

## Pengujian

- Tambah/perbarui unit test untuk `src/audio/pcm.ts`, builder prompt, parser respons AI, dan repo DB setiap kali diubah.
- Bagian audio dan telepon **harus diuji manual di HP asli**. Setelah mengubahnya, tuliskan langkah uji manual yang perlu saya lakukan.
- Jangan menyatakan fitur telepon "berfungsi" hanya karena build sukses.

## Git

- Pesan commit, judul PR, dan deskripsi PR dalam **bahasa Indonesia**, memakai prefix Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
  - Contoh: `feat: tambah pemutar audio PCM tanpa jeda`
  - Contoh: `fix: hentikan audio guru saat murid memotong pembicaraan`
- Pesan commit dan PR **netral**: hanya menjelaskan perubahan teknis. **Jangan** menyebut AI, Claude, atau asisten, dan **jangan** menambahkan trailer `Co-Authored-By` atau atribusi apa pun.
- Satu commit = satu perubahan logis. Jangan commit file rahasia, build output, atau `node_modules`.

## Cara Kerja yang Diharapkan

- Mulai setiap tugas dengan membaca bagian terkait di `ROADMAP.md` dan `ARCHITECTURE.md`.
- Untuk tugas besar, jelaskan rencana singkat dulu sebelum menulis kode.
- Jelaskan keputusan teknis penting secara singkat agar saya tetap paham kodenya.
- Jika menemukan informasi di dokumentasi Gemini yang bertentangan dengan `ARCHITECTURE.md`, ikuti dokumentasi resmi lalu perbarui `ARCHITECTURE.md`.
- Setelah tugas selesai: centang di `ROADMAP.md`, tulis temuan penting di bagian *Catatan Hasil Uji*.
