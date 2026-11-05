# CLAUDE.md

Panduan untuk Claude Code saat bekerja di repo ini.

## Proyek

**SpeakUp** — satu proyek Expo (React Native + TypeScript) yang jalan di **web** (hosting Vercel) dan **Android** (APK via EAS Build), untuk belajar bahasa Inggris dengan AI guru privat. Fitur inti adalah **telepon suara realtime** dengan guru melalui Gemini Live API. Dipakai pribadi, local-first, **tanpa biaya sama sekali**.

Baca sebelum mengerjakan apa pun:
- `PRD.md` — apa yang dibangun dan kriteria diterima.
- `ARCHITECTURE.md` — stack, struktur folder, alur telepon, skema DB.
- `PROMPTS.md` — semua prompt AI dan JSON schema.
- `ROADMAP.md` — urutan tugas. Kerjakan tugas yang diminta saja, lalu centang di sini.

## Aturan Wajib

1. **Rp0.** Jangan menambah layanan, SDK, atau dependency yang butuh billing/kartu kredit. Hanya free tier Gemini API (Google AI Studio) dan paket open source.
2. **Jangan menebak API Gemini Live.** Nama model, nama field `setup`, dan format pesan sering berubah. Sebelum menulis/mengubah kode di `src/live/`, cek dokumentasi resmi terbaru (https://ai.google.dev/gemini-api/docs/live-api dan referensi API). Jika tidak bisa memastikan, tanya dulu.
3. **Nama model hanya di `src/config/models.ts`.** Jangan hardcode nama model di tempat lain.
4. **API key tidak boleh masuk repo.** Diinput pengguna lewat UI, disimpan lewat `src/storage/apiKeyStore`: `expo-secure-store` di Android, `localStorage` di browser. Jangan buat `.env` berisi key, jangan taruh key di environment variable Vercel/EAS. Jangan log key.
5. **Audio tidak disimpan.** Hanya transkrip teks yang masuk database.
6. **Prompt sinkron dengan `PROMPTS.md`.** Jika mengubah prompt di `src/prompts/`, perbarui `PROMPTS.md` juga.
7. **Semua kode Live API di `src/live/`, semua kode audio di `src/audio/`.** UI tidak boleh berbicara langsung dengan WebSocket.
8. **UI berbahasa Indonesia.** Kode, nama variabel, dan komentar dalam bahasa Inggris.
9. **Kode per platform hanya lewat ekstensi file.** Modul yang beda di web dan Android dibuat sebagai `X.web.ts` + `X.native.ts` + `X.d.ts` (tipe), dengan interface bersama (mis. `src/audio/types.ts`). `src/live/` dan UI hanya mengimpor `X` dan tidak boleh tahu platformnya (tanpa `Platform.OS` untuk logika audio/penyimpanan). `react-native-audio-api` hanya boleh diimpor di file `.native.ts`.

## Perintah

```bash
npm install
npx expo start --web                          # pengembangan utama di browser
npx expo export --platform web                # build web ke dist/ (dipakai Vercel)
npm test                                      # Jest
npx tsc --noEmit                              # cek tipe
npx expo lint                                 # lint

# APK Android (cloud, EAS Build free plan)
npm i -g eas-cli
eas login
eas build -p android --profile preview        # hasil: link unduh APK
```

Alur: `npx expo start --web` → deploy ke Vercel (`vercel.json` sudah ada) → `eas build -p android --profile preview` → pasang APK di HP.

- **Tidak** memakai Android Studio, Android SDK lokal, JDK, `adb`, atau `npx expo run:android`. Folder `android/` dan `ios/` tidak dibuat dan tidak di-commit.
- **Expo Go tidak dipakai untuk menguji fitur telepon** (`react-native-audio-api` memakai kode native yang tidak ada di Expo Go). Uji telepon di browser atau di APK hasil EAS.
- Header `Cross-Origin-Embedder-Policy: credentialless` dan `Cross-Origin-Opener-Policy: same-origin` wajib untuk `expo-sqlite` di web; sudah dipasang di `metro.config.js` (dev) dan `vercel.json` (produksi). Jangan dihapus.

## Gaya Kode

- TypeScript `strict`. Hindari `any`; pakai `unknown` + validasi (`zod`) untuk data dari jaringan dan dari model AI.
- Komponen fungsional + hooks. State global di `zustand`, state lokal di komponen.
- Fungsi murni untuk konversi audio dan builder prompt, sehingga bisa diuji dengan Jest.
- Hasil model teks selalu divalidasi sebelum disimpan ke DB.
- Perubahan skema DB = migrasi baru (naikkan `PRAGMA user_version`), jangan ubah migrasi lama.

## Pengujian

- Tambah/perbarui unit test untuk `src/audio/pcm.ts`, builder prompt, parser respons AI, dan repo DB setiap kali diubah.
- Bagian audio dan telepon **harus diuji manual di dua platform**: browser (Chrome, via `npx expo start --web` atau URL Vercel) dan APK di HP asli. Setelah mengubahnya, tuliskan langkah uji manual yang perlu saya lakukan untuk masing-masing platform.
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
