# Roadmap — SpeakUp

Urutan pengerjaan untuk Claude Code. Kerjakan **satu fase per sesi** (atau satu tugas per sesi untuk fase besar), uji di browser dan di APK pada HP asli, commit, baru lanjut.

Alur build: `npx expo start --web` → `git push` ke `main` (Vercel auto-deploy dari GitHub) → `npm i -g eas-cli` → `eas login` → `eas build -p android --profile preview` → pasang APK. Expo Go tidak dipakai untuk menguji fitur telepon.

Tanda: `[ ]` belum, `[x]` selesai. Perbarui file ini setiap tugas selesai.

---

## Fase 0 — Persiapan (manual, oleh Mas Wahyu)

- [ ] Buat API key gratis di Google AI Studio (https://aistudio.google.com) — tanpa billing.
- [ ] Di halaman pricing, catat model Live dan model teks yang berlabel gratis di kolom Free Tier. Coba model Live itu di AI Studio → Live untuk merasakan kualitas suaranya.
- [ ] Buat repo GitHub `speakup` dan akun Vercel gratis (Hobby) yang login dengan GitHub.
- [ ] Buat akun Expo gratis untuk EAS Build; `npm i -g eas-cli` lalu `eas login`.
- [ ] HP Android asli (Android 10+) yang boleh memasang APK dari luar Play Store.
- [ ] Browser Chrome (desktop/HP) untuk menguji versi web.
- [ ] Buat repo Git baru, salin `PRD.md`, `ARCHITECTURE.md`, `PROMPTS.md`, `ROADMAP.md`, `CLAUDE.md` ke root.

---

## Fase 1 — Kerangka Proyek

- [x] Inisialisasi Expo + TypeScript + `expo-router`.
- [x] Pasang `expo-sqlite`, `expo-secure-store`, `zustand`, `buffer`, `react-native-audio-api`, `react-native-web`.
- [x] Konfigurasi izin `RECORD_AUDIO` di `app.json`.
- [x] Buat struktur folder sesuai `ARCHITECTURE.md §3` (file kosong/stub), termasuk pemisahan `*.web.ts` / `*.native.ts` untuk audio dan penyimpanan API key (§3a).
- [x] `src/config/models.ts` berisi nama model Live, model teks, voice default, durasi telepon default.
- [x] Konfigurasi web + EAS: `web.output: "single"`, `metro.config.js` (wasm + COEP/COOP), `vercel.json`, `eas.json` profil `preview` (APK).
- [x] Jalankan di browser (`npx expo start --web`): layar "Hello SpeakUp".
- [x] Deploy ke Vercel lewat dashboard (import repo GitHub, auto-deploy setiap push ke `main`; pengaturan di `ARCHITECTURE.md §12`): "Hello SpeakUp" terbuka di URL Vercel, refresh `/call/lesson` tidak 404, `crossOriginIsolated` = `true`.
- ~~`eas build -p android --profile preview` → pasang APK di HP~~ → **dipindah ke akhir Fase 2** (lihat di bawah) supaya hemat jatah EAS Build: satu build APK langsung menguji kerangka + telepon native.

**Selesai jika:** "Hello SpeakUp" tampil di URL Vercel. ✅ (uji APK menyusul di akhir Fase 2)

---

## Fase 2 — Prototipe Telepon (paling penting)

Target: bisa ngobrol suara dengan Gemini Live dari browser dan dari APK di HP. Belum ada database, belum ada kurikulum.

Urutan: **web dulu** (2a), versi `.native.ts` baru dikerjakan setelah versi web lulus uji (2b), lalu satu kali build APK (2c).

### 2a — Web
- [x] Layar input API key sederhana → simpan lewat `apiKeyStore` (secure-store di Android, localStorage di web).
- [x] `src/audio/pcm.ts` + unit test: Float32↔Int16, resample ke 16 kHz, base64.
- [x] `MicStreamer.web.ts` (getUserMedia + AudioWorklet): rekam, resample, kirim chunk ~100 ms via callback.
- [x] `PcmPlayer.web.ts`: antrean PCM 24 kHz tanpa jeda + `flush()`.
- [x] `LiveClient`: buka WebSocket, kirim `setup`, tunggu `setupComplete`, kirim audio, parse pesan server, event `audio`, `interrupted`, `inputTranscript`, `outputTranscript`, `turnComplete`, `close`, `error`.
- [x] Prompt sementara: guru bahasa Inggris sederhana (`PROMPTS.md §0`).
- [x] Layar telepon minimal: tombol Telepon / Tutup, status, timer.
- [x] Log transkrip ke console.
- [ ] Uji di browser (lokal + URL Vercel).

### 2b — Android (setelah 2a lulus uji)
- [ ] `MicStreamer.native.ts` (react-native-audio-api).
- [ ] `PcmPlayer.native.ts` (react-native-audio-api).

### 2c — Build APK (dipindah dari Fase 1)
- [ ] `eas build -p android --profile preview` → pasang APK di HP: "Hello SpeakUp" tampil, lalu uji telepon.

**Selesai jika:**
- Guru menyapa dan menjawab dengan suara jernih tanpa putus-putus.
- Saat Mas Wahyu bicara di tengah jawaban guru, guru berhenti (barge-in).
- Transkrip dua arah tercetak di log.
- Diuji di browser (Chrome) dan di APK, dengan speaker dan earphone; catat hasil soal gema di bagian *Catatan* di bawah.

---

## Fase 3 — Layar Telepon Lengkap

- [ ] `useLiveCall` dengan state mesin (`ARCHITECTURE.md §4`).
- [ ] UI bergaya telepon: avatar guru, status, timer, Mute, Speaker, Tutup, indikator level suara.
- [ ] Mute → hentikan kirim audio + `audioStreamEnd`.
- [ ] Peringatan di menit 13, otomatis berakhir di menit 15 (dari config).
- [ ] `contextWindowCompression` + `sessionResumption` + penanganan `goAway`.
- [ ] Penanganan error sesuai `ARCHITECTURE.md §10`.
- [ ] Layar tetap menyala selama telepon (`expo-keep-awake`).

**Selesai jika:** telepon 15 menit penuh berjalan tanpa putus, dan mode pesawat di tengah telepon ditangani dengan rapi.

---

## Fase 4 — Database & Onboarding

- [ ] `db/client.ts` + migrasi v1 (skema `ARCHITECTURE.md §8`).
- [ ] Repo: profile, sessions, transcript_turns, curriculum, mistakes, vocabulary, settings.
- [ ] Onboarding: self-assessment, tujuan, menit per hari, peringatan privasi, API key.
- [ ] Simpan setiap sesi telepon + transkrip ke DB.

**Selesai jika:** setelah app ditutup dan dibuka lagi, data profil dan riwayat transkrip masih ada.

---

## Fase 5 — Placement & Kurikulum

- [ ] `ai/textModel.ts`: wrapper `generateContent` + JSON schema + validasi `zod` + retry sekali.
- [ ] Prompt `placementCall` di mode telepon `placement`.
- [ ] `placement()` → simpan level, kekuatan, kelemahan, minat, porsi bahasa Indonesia.
- [ ] Layar hasil placement (bahasa Indonesia).
- [ ] `planCurriculum()` mode `initial` → simpan unit.
- [ ] Beranda: "Pelajaran hari ini" = unit `pending`/`needs_review` posisi terkecil.

**Selesai jika:** alur onboarding → placement → hasil level → beranda dengan pelajaran pertama berjalan mulus.

---

## Fase 6 — Telepon Pelajaran, Laporan, Memori Guru

- [ ] Builder system prompt `tutorCall` (profil + pelajaran + preferensi), batas panjang.
- [ ] `analyzeSession()` setelah telepon (lewati jika < 30 detik).
- [ ] Simpan laporan, skor, mistakes, vocabulary; perbarui `tutor_notes`, minat, status unit.
- [ ] Layar Laporan Sesi.
- [ ] Hitung `recurring_mistakes` (5 `pattern_key` terbanyak dari 5 sesi terakhir) untuk prompt berikutnya.
- [ ] Pemicu `planCurriculum` mode `extend` dan `remedial` (`PROMPTS.md §5`).

**Selesai jika:** pada telepon ke-2 dan ke-3, guru melatih ulang kesalahan dari sesi sebelumnya tanpa diminta. → **MVP (v0.5) tercapai.**

---

## Fase 7 — v1.0

- [ ] Pengaturan: voice guru, kecepatan, porsi bahasa Indonesia, reset progres.
- [ ] Riwayat sesi + buka laporan & transkrip lama.
- [ ] Bank kosakata + review flashcard (spaced repetition sederhana).
- [ ] Progres: grafik skor, total menit, streak.
- [ ] Subtitle opsional saat telepon.
- [ ] Mode *push-to-talk* (jika gema jadi masalah).

---

## Fase 8 — v1.x (nanti)

- [ ] Placement ulang otomatis tiap 10 sesi → bisa naik level.
- [ ] Mode skenario bebas (interview kerja, restoran, bandara).
- [ ] Pengingat harian (notifikasi lokal).
- [ ] Ekspor/impor backup DB ke file.
- [ ] Jika ingin dibagikan ke orang lain: backend *ephemeral token* gratis (Cloudflare Workers).

---

## Catatan Hasil Uji

_Isi selama pengerjaan: latensi, perilaku gema, model yang dipakai, batas kuota yang ditemui, dll._

- **Fase 1 (2026-11-05):** Expo SDK 58, React Native 0.88, TypeScript 6. Model dari dokumentasi resmi: Live `gemini-3.8-live`, teks `gemini-3.8-flash` (fallback `gemini-3.5-flash-lite`), voice `Kore`.
- TypeScript 6 tidak lagi otomatis memuat `@types/*`, jadi `tsconfig.json` diberi `"types": ["jest"]`.
- `react-dom` dibutuhkan sebagai peer dependency `expo-router` (dan untuk target web).
- `expo prebuild` sukses: manifest berisi `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`, `minSdkVersion=29`, tanpa foreground service.
- **Pindah ke web + EAS (2026-11-05):** `expo-dev-client` dilepas (APK `preview` adalah build release, tidak butuh dev client). `expo-secure-store` tidak mendukung web → `apiKeyStore.web.ts` memakai `localStorage`.
- Resolusi platform terverifikasi dengan `expo export`: bundle web hanya berisi `*.web.ts` (tanpa `react-native-audio-api`), bundle Android hanya berisi `*.native.ts`.
- `expo-sqlite` web: header COEP `credentialless` + COOP `same-origin` wajib (dok resmi SDK 58). Di web tidak ada FTS.
- **Uji web lokal (2026-11-05, Microsoft Edge, Windows):** `npx expo start --web` → "Hello SpeakUp" tampil; `crossOriginIsolated` = `true` (header COEP/COOP dari `metro.config.js` aktif); `/call/lesson` tampil ("Telepon Guru – Mode: lesson").
- **Uji Vercel (2026-11-05):** https://speakup-phi-one.vercel.app — import repo GitHub di dashboard, auto-deploy dari `main`. "Hello SpeakUp" tampil; refresh `/call/lesson` tidak 404 (rewrite SPA bekerja); `crossOriginIsolated` = `true` (header dari `vercel.json` terkirim).
- **Fase 2a (kode, 2026-11-05):** belum diuji manual. Mic web memakai `AudioContext({ sampleRate: 16000 })` agar browser yang me-resample; jika browser menolak, jatuh ke sample rate perangkat + `StreamingResampler` di `pcm.ts`. Sapaan pembuka dipicu lewat `clientContent`. Koneksi Live hanya ~10 menit per WebSocket menurut dokumentasi → sambung ulang dengan `sessionResumption` wajib di Fase 3.
- **Perubahan urutan:** uji build APK (`eas build -p android --profile preview`) ditunda dari Fase 1 ke akhir Fase 2 (2c) untuk menghemat jatah EAS Build free plan.
