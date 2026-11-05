# Arsitektur Teknis — SpeakUp

Dokumen ini menjelaskan *bagaimana* aplikasi dibangun. *Apa* yang dibangun ada di `PRD.md`.

> **Catatan penting:** Gemini Live API masih berkembang cepat (banyak model berstatus *preview*). Sebelum mengerjakan bagian Live API, selalu cek dokumentasi resmi terbaru:
> - https://ai.google.dev/gemini-api/docs/live-api
> - https://ai.google.dev/gemini-api/docs/pricing (pastikan model berlabel *Free of charge* di kolom Free Tier)
> - https://ai.google.dev/gemini-api/docs/rate-limits
>
> Per 5 November 2026, URL `ai.google.dev/gemini-api/docs/*` dialihkan (301) ke `aistudio.google.com/docs/*` dengan isi yang sama. Angka kuota free tier tidak tercantum di halaman rate-limits; lihat di https://aistudio.google.com/rate-limit.
>
> Jangan menebak nama model atau nama field dari ingatan. Semua nama model disimpan di `src/config/models.ts`.

---

## 1. Prinsip

1. **Rp0.** Tidak ada server berbayar, tidak ada layanan berkartu kredit.
2. **Local-first.** Semua data di SQLite pada perangkat (HP, atau browser lewat `expo-sqlite` web). Tidak ada backend di v1; Vercel hanya menyajikan file statis.
3. **Satu kode, dua platform.** Proyek Expo yang sama jalan di web (lingkungan pengembangan utama, hosting Vercel) dan Android (APK via EAS Build). Perbedaan platform hanya di modul `*.web.ts` / `*.native.ts` (lihat §3a).
4. **Telepon dulu.** Jalur audio realtime adalah bagian paling berisiko; dikerjakan dan distabilkan paling awal.
5. **Dua model, dua peran.**
   - *Model Live* (suara-ke-suara) → menjalankan telepon.
   - *Model teks* (Gemini Flash / Flash-Lite free tier) → analisis transkrip, koreksi, penyusunan kurikulum. Output selalu JSON terstruktur.

## 2. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Expo (SDK terbaru) + React Native + TypeScript | Sudah familiar, gratis |
| Web | `react-native-web`, `web.output: "single"` (SPA), `npx expo export --platform web` → `dist/` | Lingkungan pengembangan utama; tanpa toolchain Android lokal |
| Hosting web | Vercel (Hobby, gratis) dengan `vercel.json` | Rewrite semua path ke `/` untuk expo-router + header COEP/COOP untuk `expo-sqlite` |
| Build Android | **EAS Build** (cloud, free plan) profil `preview` → APK (`eas build -p android --profile preview`) | Tanpa Android Studio/SDK/JDK lokal. Free plan: 15 build Android, antrean prioritas rendah. Folder `android/` dibuat di server EAS, tidak di-commit. **Expo Go tidak dipakai** untuk menguji telepon (audio memakai kode native) |
| Navigasi | `expo-router` | Berbasis file, sederhana |
| State | `zustand` | Ringan |
| Database | `expo-sqlite` | Lokal, gratis. Di web memakai build WebAssembly: butuh `wasm` di `assetExts` Metro dan header `Cross-Origin-Embedder-Policy: credentialless` + `Cross-Origin-Opener-Policy: same-origin` (dipasang di `metro.config.js` untuk dev dan `vercel.json` untuk produksi). Di web tidak ada full-text search (FTS) |
| Penyimpanan API key | `src/storage/apiKeyStore`: `expo-secure-store` (Android) / `localStorage` (web) | `expo-secure-store` tidak mendukung web. Key hanya ada di perangkat/browser pengguna, tidak pernah di repo atau env var Vercel/EAS |
| Audio Android | `react-native-audio-api` (Software Mansion), hanya di `*.native.ts` | API mirip Web Audio: `AudioRecorder` untuk frame PCM, `AudioContext` untuk pemutaran terjadwal tanpa jeda |
| Audio web | API browser: `getUserMedia` + Web Audio (`AudioContext`, `AudioWorklet`), hanya di `*.web.ts` | Mikrofon butuh HTTPS (Vercel) atau `localhost` |
| Izin mikrofon | API izin bawaan library audio | Android `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS`, didaftarkan lewat config plugin `react-native-audio-api` di `app.json`. Foreground service bawaan plugin dimatikan (telepon selalu di depan layar); jika nanti butuh mic di latar, tipe service harus `microphone`, bukan `mediaPlayback` |
| Konfigurasi native | `expo-build-properties` | `minSdkVersion` 29 (Android 10+). Semua konfigurasi native lewat `app.json` (CNG); EAS Build menjalankan prebuild di cloud |
| Encoding | `buffer` (polyfill) | Base64 untuk PCM |
| Validasi | `zod` | Validasi respons model AI & pesan server |
| Layar menyala | `expo-keep-awake` | Layar tidak mati selama telepon |
| Transport Live | `WebSocket` bawaan React Native | Tanpa dependency tambahan |
| Model teks | REST `generateContent` via `fetch` | Sederhana, tanpa SDK |
| UI | StyleSheet / NativeWind (opsional) | Bebas |

Alternatif jika `react-native-audio-api` bermasalah di Android: `@siteed/expo-audio-studio` untuk rekam, atau modul Expo native kecil yang membungkus `AudioRecord`/`AudioTrack` Android. Karena audio dipisah per platform, mengganti library Android tidak mengubah versi web.

## 3. Struktur Folder

```
speakup/
├── app/                          # expo-router
│   ├── _layout.tsx
│   ├── index.tsx                 # Beranda
│   ├── onboarding/
│   │   ├── index.tsx             # Self-assessment
│   │   └── api-key.tsx           # Input API key
│   ├── call/
│   │   └── [mode].tsx            # Layar telepon (mode: placement | lesson | free)
│   ├── report/[sessionId].tsx    # Laporan sesi
│   ├── history.tsx
│   ├── vocabulary.tsx
│   └── settings.tsx
├── src/
│   ├── config/
│   │   └── models.ts             # Nama model, voice default, batas durasi
│   ├── live/                     # SEMUA kode Gemini Live di sini
│   │   ├── LiveClient.ts         # WebSocket, setup, kirim/terima pesan
│   │   ├── types.ts              # Tipe pesan client/server
│   │   └── useLiveCall.ts        # Hook: state telepon untuk UI
│   ├── audio/                    # SEMUA kode audio di sini (lihat §3a)
│   │   ├── types.ts              # Interface MicStreamer & PcmPlayer (bersama)
│   │   ├── MicStreamer.d.ts      # Tipe modul untuk TypeScript
│   │   ├── MicStreamer.web.ts    # getUserMedia + Web Audio → 16 kHz → Int16 → base64
│   │   ├── MicStreamer.native.ts # react-native-audio-api → 16 kHz → Int16 → base64
│   │   ├── PcmPlayer.d.ts
│   │   ├── PcmPlayer.web.ts      # base64 → Int16 24 kHz → Float32 → antrean putar (browser)
│   │   ├── PcmPlayer.native.ts   # idem, react-native-audio-api
│   │   └── pcm.ts                # Utilitas konversi & resample (murni, bersama)
│   ├── storage/
│   │   ├── apiKeyStore.types.ts  # Interface ApiKeyStore
│   │   ├── apiKeyStore.d.ts
│   │   ├── apiKeyStore.web.ts    # localStorage
│   │   └── apiKeyStore.native.ts # expo-secure-store
│   ├── ai/
│   │   ├── textModel.ts          # Wrapper generateContent + JSON schema
│   │   ├── analyzeSession.ts     # Transkrip → laporan sesi
│   │   ├── placement.ts          # Transkrip placement → level
│   │   └── curriculum.ts         # Susun / perbarui kurikulum
│   ├── prompts/                  # Isi diambil dari PROMPTS.md
│   │   ├── tutorCall.ts
│   │   ├── placementCall.ts
│   │   ├── analyzeSession.ts
│   │   └── curriculum.ts
│   ├── db/
│   │   ├── client.ts             # Buka DB + migrasi (PRAGMA user_version)
│   │   ├── migrations.ts
│   │   └── repos/                # profile, sessions, curriculum, mistakes, vocab
│   ├── store/                    # zustand stores
│   └── components/
├── app.json                      # android.package, version, versionCode, web.output
├── eas.json                      # profil EAS Build (preview → APK)
├── vercel.json                   # build web, rewrite expo-router, header COEP/COOP
├── metro.config.js               # wasm + header COEP/COOP untuk dev server
├── PRD.md
├── ARCHITECTURE.md
├── PROMPTS.md
├── ROADMAP.md
└── CLAUDE.md
```

## 3a. Kode per Platform

Metro memilih file berdasarkan platform: `X.web.ts` untuk web, `X.native.ts` untuk Android. TypeScript membaca `X.d.ts` yang berisi tipe ekspor yang sama. Pemanggil cukup menulis:

```ts
import { createMicStreamer } from '@/audio/MicStreamer';
import { apiKeyStore } from '@/storage/apiKeyStore';
```

Aturan:
- Setiap pasangan `.web.ts` / `.native.ts` wajib mengimplementasikan interface yang sama (`src/audio/types.ts`, `src/storage/apiKeyStore.types.ts`); `X.d.ts` mengekspor tipe dari interface itu.
- `src/live/`, `src/ai/`, `src/db/`, dan UI tidak boleh tahu platformnya.
- `react-native-audio-api` hanya diimpor di `*.native.ts`; API browser (`navigator.mediaDevices`, `AudioContext` global, `localStorage`) hanya di `*.web.ts`.
- `WebSocket` dan `fetch` tersedia di kedua platform, jadi `src/live/` dan `src/ai/` cukup satu versi.

## 4. Alur Telepon (inti)

```
[Tombol Telepon]
   │
   ├─ 1. Minta izin mikrofon
   ├─ 2. Bangun system instruction:
   │      template guru (PROMPTS.md) + profil murid + rencana pelajaran hari ini
   ├─ 3. Buka WebSocket ke endpoint Live API (BidiGenerateContent)
   ├─ 4. Kirim pesan `setup` (lihat §5) → tunggu `setupComplete`
   ├─ 5. Mulai MicStreamer: tiap ~100 ms kirim `realtimeInput.audio`
   │      (PCM 16-bit, 16 kHz, mono, little-endian, base64,
   │       mimeType "audio/pcm;rate=16000")
   ├─ 6. Terima pesan server:
   │      • serverContent.modelTurn.parts[].inlineData → audio guru (PCM 24 kHz) → PcmPlayer.enqueue()
   │      • serverContent.interrupted → PcmPlayer.flush() (barge-in)
   │      • serverContent.inputTranscription → simpan sebagai giliran "user"
   │      • serverContent.outputTranscription → simpan sebagai giliran "tutor"
   │      • serverContent.turnComplete → tutup giliran
   │      • sessionResumptionUpdate → simpan handle terbaru
   │      • goAway → siapkan sambung ulang dengan handle resumption
   ├─ 7. [Tutup] → stop mic, flush player, tutup socket
   └─ 8. Simpan transkrip → jalankan analyzeSession() → buka layar Laporan
```

### State mesin `useLiveCall`

```
idle → connecting → active ⇄ (userSpeaking | tutorSpeaking | listening)
                       ↓
               reconnecting → active
                       ↓
          ending → analyzing → done
     (error dari state mana pun → error, transkrip tetap disimpan)
```

## 5. Konfigurasi Sesi Live

Pesan `setup` pertama. Nama field diverifikasi 5 November 2026 terhadap referensi `BidiGenerateContent` dan panduan migrasi `gemini-3.8-live`; tetap **wajib dicek ulang** sebelum mengubah `src/live/`. Builder: `src/live/messages.ts` (`buildSetupMessage`). Fase 2 belum mengirim dua field terakhir; keduanya ditambahkan di Fase 3.

```jsonc
{
  "setup": {
    "model": "models/<LIVE_MODEL dari src/config/models.ts>",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "<voice pilihan>" } }
      }
    },
    "systemInstruction": { "parts": [{ "text": "<system prompt hasil build>" }] },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {},
    "contextWindowCompression": { "slidingWindow": {} },
    "sessionResumption": {}
  }
}
```

- **Model:** pilih model Live yang di halaman pricing tertulis gratis di kolom Free Tier. Dicek 5 November 2026: `gemini-3.8-live` adalah model default Live API (gratis, dipakai di semua contoh resmi); `gemini-3.1-flash-live-preview` sudah berlabel *legacy*. Model teks: `gemini-3.8-flash` dengan fallback `gemini-3.5-flash-lite` saat kuota habis. Voice default di contoh resmi: `Kore`. Semua nilai ini hanya ada di `src/config/models.ts`.
- **Deteksi suara (VAD):** pakai deteksi otomatis bawaan dulu. Jika guru terlalu cepat memotong saat murid berpikir, atur sensitivitas akhir bicara di `realtimeInputConfig.automaticActivityDetection` — pemula butuh jeda lebih panjang.
- **Durasi:** menurut dokumentasi, sesi audio tanpa kompresi dibatasi 15 menit, dan **satu koneksi WebSocket hidup sekitar 10 menit** (server mengirim `goAway` sebelum memutus). Jadi telepon 15 menit pasti butuh `contextWindowCompression` + `sessionResumption` (handle berlaku 2 jam) + sambung ulang otomatis (Fase 3). Default timer telepon di app: 15 menit, dengan peringatan di menit 13.
- **Khusus `gemini-3.8-live`:** respons hanya `AUDIO`; `thinkingConfig`/`thinking_level` tidak didukung (jangan dikirim); *proactive audio* selalu aktif (`proactive_audio: false` = error); *affective dialog* dihapus.
- **Audio masuk:** `realtimeInput.audio` = `{ data: <base64>, mimeType: "audio/pcm;rate=16000" }` (PCM 16-bit LE). `mediaChunks` sudah *deprecated*. `realtimeInput.audioStreamEnd: true` hanya saat deteksi aktivitas otomatis aktif (default).
- **Audio keluar:** `serverContent.modelTurn.parts[].inlineData.data`, PCM 16-bit LE 24 kHz. Dokumentasi tidak menyebut `mimeType`-nya, jadi parser menerima part tanpa `mimeType` atau yang berawalan `audio/`.
- **Guru bicara duluan:** model Live baru menjawab setelah ada input. Setelah `setupComplete`, klien mengirim satu giliran teks `user` lewat `clientContent` dengan `turnComplete: true` (teks pemicu ada di `PROMPTS.md`). Untuk 3.8, `clientContent` didukung sepanjang sesi, tetapi `turnComplete: true` selalu menginterupsi generasi yang sedang berjalan, jadi hanya dipakai di awal.
- **Frame WebSocket:** contoh resmi memperlakukan pesan server sebagai teks JSON. Klien memasang `binaryType = "arraybuffer"` dan tetap bisa mendekode frame teks, `ArrayBuffer`, maupun `Blob`.
- **Error:** dokumentasi tidak mendaftar kode close/error (key salah, kuota habis). Klien meneruskan `code` + `reason` dari event `close` ke UI sebagai detail; catat nilai yang benar-benar muncul di *Catatan Hasil Uji* ROADMAP.

### Endpoint & autentikasi

- WebSocket: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=<API_KEY>`
- v1 (pribadi): API key dari Google AI Studio, dimasukkan pengguna di layar onboarding dan disimpan lewat `apiKeyStore` (`expo-secure-store` di Android, `localStorage` di browser). **Tidak pernah** di-commit, ditaruh di `.env`, atau di environment variable Vercel/EAS. Situs Vercel bersifat publik tetapi kosong dari key: siapa pun yang membukanya harus memasukkan key sendiri, dan key itu hanya tersimpan di browsernya.
- Catatan web: `localStorage` lebih lemah daripada Keystore Android (bisa dibaca skrip apa pun di origin yang sama). Karena itu situs tidak memuat skrip pihak ketiga.
- Jika suatu saat APK dibagikan: pindah ke *ephemeral token* yang dicetak oleh backend kecil gratis (misalnya Cloudflare Workers free plan), sehingga API key asli tidak ada di APK.

## 6. Pipeline Audio

Langkah di bawah sama untuk kedua platform; yang berbeda hanya sumber frame dan konteks pemutaran (`react-native-audio-api` di Android, `getUserMedia` + `AudioContext`/`AudioWorklet` browser di web). Konversi dan resample memakai `pcm.ts` yang sama.

### Mikrofon → server (`MicStreamer`)
1. `AudioRecorder` (Android) atau `getUserMedia` + `AudioWorklet` (web) menghasilkan frame Float32 pada sample rate perangkat (sering 44,1/48 kHz).
2. Resample ke **16 kHz** (downsample linear cukup untuk suara).
3. Konversi Float32 [-1, 1] → Int16 little-endian (clamp).
4. Kumpulkan per ~100 ms (1.600 sampel), encode base64, kirim.
5. Saat mute: berhenti kirim, dan kirim `audioStreamEnd: true` agar server tahu stream jeda.

### Server → speaker (`PcmPlayer`)
1. Decode base64 → Int16 → Float32.
2. Buat `AudioBuffer` dengan sample rate **24 kHz**.
3. Jadwalkan back-to-back: `startAt = max(ctx.currentTime, nextStartTime)`; `nextStartTime = startAt + buffer.duration`. Ini yang membuat audio tanpa jeda.
4. `flush()`: hentikan semua source aktif, kosongkan antrean, reset `nextStartTime`. Dipanggil saat `interrupted` atau tutup telepon.

### Gema (echo)
Jika suara guru dari speaker terekam lagi oleh mikrofon, model bisa "memotong dirinya sendiri". Mitigasi berurutan:
1. Aktifkan mode audio komunikasi / echo cancellation jika library mendukung. Di web: `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`.
2. Sarankan earphone di layar telepon (tips kecil).
3. Fallback: tombol "tahan untuk bicara" (*push-to-talk*) sebagai mode alternatif.

## 7. Model Teks (analisis & kurikulum)

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/<TEXT_MODEL>:generateContent` dengan header `x-goog-api-key`.
- Selalu pakai `generationConfig.responseMimeType = "application/json"` + `responseSchema`, lalu validasi hasilnya di kode (misalnya dengan `zod`). Jika gagal parse → coba ulang sekali → jika masih gagal, simpan transkrip dan tandai laporan "gagal dianalisis, coba lagi".
- Tiga pemanggilan utama (prompt lengkap di `PROMPTS.md`):
  1. `placement(transcript, selfAssessment)` → level + kekuatan/kelemahan.
  2. `analyzeSession(transcript, lesson, profile)` → laporan sesi + perubahan profil.
  3. `planCurriculum(profile, history)` → daftar unit / unit berikutnya.

## 8. Skema Database

Migrasi dikelola dengan `PRAGMA user_version`.

```sql
-- Profil murid (1 baris)
CREATE TABLE learner_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  self_assessment TEXT NOT NULL,          -- "hampir_nol" | "dasar" | "menengah" | "lancar"
  goals TEXT NOT NULL,                    -- JSON array
  daily_minutes INTEGER NOT NULL DEFAULT 15,
  cefr_level TEXT,                        -- A1..C2, null sebelum placement
  strengths TEXT,                         -- JSON array string
  weaknesses TEXT,                        -- JSON array string
  interests TEXT,                         -- JSON array string
  tutor_notes TEXT,                       -- ringkasan bebas untuk disisipkan ke prompt (maks ~1.500 karakter)
  updated_at TEXT NOT NULL
);

CREATE TABLE curriculum_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,
  cefr_level TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_vocab TEXT NOT NULL,             -- JSON array
  target_grammar TEXT NOT NULL,           -- JSON array
  scenario TEXT,                          -- situasi roleplay, opsional
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | done | needs_review
  is_remedial INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,                     -- placement | lesson | free
  unit_id INTEGER REFERENCES curriculum_units(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_sec INTEGER,
  end_reason TEXT,                        -- user_hangup | timeout | error | quota
  report_json TEXT,                       -- hasil analyzeSession (null jika belum/ gagal)
  score_fluency INTEGER,
  score_grammar INTEGER,
  score_vocab INTEGER
);

CREATE TABLE transcript_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  speaker TEXT NOT NULL,                  -- user | tutor
  text TEXT NOT NULL
);

CREATE TABLE mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                 -- grammar | vocabulary | pronunciation | word_order
  original TEXT NOT NULL,
  corrected TEXT NOT NULL,
  explanation_id TEXT NOT NULL,           -- penjelasan bahasa Indonesia
  pattern_key TEXT                        -- label pola untuk deteksi kesalahan berulang, mis. "past_tense_irregular"
);

CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  meaning_id TEXT NOT NULL,
  example TEXT,
  first_session_id INTEGER REFERENCES sessions(id),
  ease REAL NOT NULL DEFAULT 2.5,          -- untuk spaced repetition (P1)
  interval_days INTEGER NOT NULL DEFAULT 0,
  due_at TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

API key **tidak** disimpan di tabel `settings`, melainkan lewat `apiKeyStore` (`expo-secure-store` / `localStorage`).

## 9. Penyusunan System Prompt Telepon

```
[Template guru dari PROMPTS.md]
+ [Profil murid: level, kelemahan, kesalahan berulang (5 pattern_key teratas), minat, tutor_notes]
+ [Pelajaran hari ini: judul, tujuan, kosakata target, grammar target, skenario]
+ [Preferensi: porsi bahasa Indonesia, kecepatan bicara]
```

Batasi total panjang (misalnya < 6.000 karakter) agar hemat token dan respons cepat.

## 10. Penanganan Error

| Kondisi | Perilaku app |
|---|---|
| Izin mikrofon ditolak | Layar penjelasan + tombol buka pengaturan |
| API key kosong/salah | Arahkan ke layar API key |
| Kuota habis / ditolak | Pesan "Kuota gratis hari ini habis, coba lagi nanti"; `end_reason = 'quota'` |
| Socket putus | Coba sambung ulang 1–2 kali dengan handle resumption; jika gagal, akhiri sesi dan tetap analisis transkrip yang ada |
| Analisis gagal | Laporan bertanda gagal + tombol "Analisis ulang" |
| Telepon < 30 detik | Tidak dianalisis, tidak mengubah kurikulum |

## 11. Pengujian

- **Unit test** (Jest): `pcm.ts` (resample, konversi Int16/Float32, base64), builder system prompt, validasi JSON hasil model teks, repo database.
- **Uji manual di dua platform:** browser (Chrome desktop/HP, lewat `npx expo start --web` atau URL Vercel) dan APK di HP asli. Cek latensi, barge-in, echo dengan speaker vs earphone, telepon 15 menit, mode pesawat/putus jaringan di tengah telepon. Expo Go tidak dipakai.
- Simpan contoh transkrip di `__fixtures__/` untuk menguji `analyzeSession` tanpa menelepon.

## 12. Build & Deploy

```
npx expo start --web                         # 1. kembangkan & uji di browser
npx expo export --platform web               # 2. (opsional) cek build web ke dist/
git push origin main                         # 3. Vercel auto-deploy dari GitHub (pakai vercel.json)
npm i -g eas-cli && eas login                # 4. sekali saja
eas build -p android --profile preview       # 5. APK di cloud → link unduh
                                             # 6. buka link di HP, pasang APK
```

- `vercel.json`: `buildCommand: expo export -p web`, `outputDirectory: dist`, rewrite `/:path*` → `/` (SPA expo-router), header COEP `credentialless` + COOP `same-origin`. Tidak ada environment variable.

### Deploy web: import repo GitHub di dashboard Vercel

Deploy **tidak** memakai Vercel CLI. Repo `https://github.com/wahyusuhar/speakup` diimpor sekali di dashboard; setelah itu setiap push ke `main` otomatis membuat deploy *production*, dan push ke branch lain membuat deploy *preview*.

Pengaturan saat import (vercel.com → **Add New… → Project** → pilih repo `speakup` → **Import**):

| Field | Isi |
|---|---|
| Project Name | `speakup` |
| Framework Preset | **Other** (`vercel.json` sudah menetapkan `"framework": null`) |
| Root Directory | `./` (biarkan) |
| Build Command | biarkan default/kosong; diambil dari `vercel.json` (`expo export -p web`) |
| Output Directory | biarkan default/kosong; diambil dari `vercel.json` (`dist`) |
| Install Command | biarkan default; Vercel mendeteksi `package-lock.json` dan menjalankan `npm install` |
| Environment Variables | **kosongkan.** API key tidak boleh ada di Vercel |

Setelah proyek dibuat, cek di **Settings**:
- **Git → Production Branch:** `main`.
- **Build and Deployment → Node.js Version:** versi LTS yang didukung Expo SDK 58; samakan dengan Node lokal jika build gagal karena versi Node.
- **Headers:** tidak perlu diatur di dashboard; header COEP/COOP berasal dari `vercel.json`. Verifikasi di browser: Console → `crossOriginIsolated` harus `true`.
- `eas.json` profil `preview`: `distribution: internal`, `android.buildType: apk`. `cli.appVersionSource: local`, jadi versi diambil dari `app.json` (`version`, `android.versionCode`). Naikkan `versionCode` setiap APK baru yang akan dipasang menimpa versi lama.
- `eas build` pertama kali akan meminta membuat proyek EAS dan menambahkan `extra.eas.projectId` ke `app.json`; itu aman di-commit.
