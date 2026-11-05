# Roadmap — SpeakUp

Urutan pengerjaan untuk Claude Code. Kerjakan **satu fase per sesi** (atau satu tugas per sesi untuk fase besar), uji di HP asli, commit, baru lanjut.

Tanda: `[ ]` belum, `[x]` selesai. Perbarui file ini setiap tugas selesai.

---

## Fase 0 — Persiapan (manual, oleh Mas Wahyu)

- [ ] Buat API key gratis di Google AI Studio (https://aistudio.google.com) — tanpa billing.
- [ ] Di halaman pricing, catat model Live dan model teks yang berlabel gratis di kolom Free Tier. Coba model Live itu di AI Studio → Live untuk merasakan kualitas suaranya.
- [ ] Siapkan Android Studio + SDK + JDK untuk build lokal.
- [ ] HP Android asli dengan USB debugging aktif (audio di emulator sering bermasalah).
- [ ] Buat repo Git baru, salin `PRD.md`, `ARCHITECTURE.md`, `PROMPTS.md`, `ROADMAP.md`, `CLAUDE.md` ke root.

---

## Fase 1 — Kerangka Proyek

- [x] Inisialisasi Expo + TypeScript + `expo-router`.
- [x] Pasang `expo-dev-client`, `expo-sqlite`, `expo-secure-store`, `zustand`, `buffer`, `react-native-audio-api`.
- [x] Konfigurasi izin `RECORD_AUDIO` di `app.json`.
- [x] Buat struktur folder sesuai `ARCHITECTURE.md §3` (file kosong/stub).
- [x] `src/config/models.ts` berisi nama model Live, model teks, voice default, durasi telepon default.
- [ ] Build lokal dan jalankan di HP: layar "Hello SpeakUp". _(menunggu Android Studio/JDK terpasang)_

**Selesai jika:** `npx expo run:android` berhasil memasang dev build di HP.

---

## Fase 2 — Prototipe Telepon (paling penting)

Target: bisa ngobrol suara dengan Gemini Live dari HP. Belum ada database, belum ada kurikulum.

- [ ] Layar input API key sederhana → simpan di `expo-secure-store`.
- [ ] `src/audio/pcm.ts` + unit test: Float32↔Int16, resample ke 16 kHz, base64.
- [ ] `MicStreamer`: rekam, resample, kirim chunk ~100 ms via callback.
- [ ] `PcmPlayer`: antrean PCM 24 kHz tanpa jeda + `flush()`.
- [ ] `LiveClient`: buka WebSocket, kirim `setup`, tunggu `setupComplete`, kirim audio, parse pesan server, event `audio`, `interrupted`, `inputTranscript`, `outputTranscript`, `turnComplete`, `close`, `error`.
- [ ] Prompt sementara: guru bahasa Inggris sederhana.
- [ ] Layar telepon minimal: tombol Telepon / Tutup, status, timer.
- [ ] Log transkrip ke console.

**Selesai jika:**
- Guru menyapa dan menjawab dengan suara jernih tanpa putus-putus.
- Saat Mas Wahyu bicara di tengah jawaban guru, guru berhenti (barge-in).
- Transkrip dua arah tercetak di log.
- Diuji dengan speaker dan earphone; catat hasil soal gema di bagian *Catatan* di bawah.

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
- `react-dom` tetap dibutuhkan sebagai peer dependency `expo-router` walau app hanya Android.
- `expo prebuild` sukses: manifest berisi `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`, `minSdkVersion=29`, tanpa foreground service.
