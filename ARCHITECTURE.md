# Arsitektur Teknis — SpeakUp

Dokumen ini menjelaskan *bagaimana* aplikasi dibangun. *Apa* yang dibangun ada di `PRD.md`.

> **Catatan penting:** Gemini Live API masih berkembang cepat (banyak model berstatus *preview*). Sebelum mengerjakan bagian Live API, selalu cek dokumentasi resmi terbaru:
> - https://ai.google.dev/gemini-api/docs/live-api
> - https://ai.google.dev/gemini-api/docs/pricing (pastikan model berlabel *Free of charge* di kolom Free Tier)
> - https://ai.google.dev/gemini-api/docs/rate-limits
>
> Jangan menebak nama model atau nama field dari ingatan. Semua nama model disimpan di `src/config/models.ts`.

---

## 1. Prinsip

1. **Rp0.** Tidak ada server berbayar, tidak ada layanan berkartu kredit.
2. **Local-first.** Semua data di SQLite pada HP. Tidak ada backend di v1.
3. **Telepon dulu.** Jalur audio realtime adalah bagian paling berisiko; dikerjakan dan distabilkan paling awal.
4. **Dua model, dua peran.**
   - *Model Live* (suara-ke-suara) → menjalankan telepon.
   - *Model teks* (Gemini Flash / Flash-Lite free tier) → analisis transkrip, koreksi, penyusunan kurikulum. Output selalu JSON terstruktur.

## 2. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Expo (SDK terbaru) + React Native + TypeScript | Sudah familiar, gratis |
| Build | **Development build** (`expo-dev-client`) + build lokal (`npx expo run:android` / Gradle) | Library audio memakai kode native, tidak jalan di Expo Go. Build lokal = gratis, tanpa kuota EAS |
| Navigasi | `expo-router` | Berbasis file, sederhana |
| State | `zustand` | Ringan |
| Database | `expo-sqlite` | Lokal, gratis |
| Penyimpanan rahasia | `expo-secure-store` | Untuk API key |
| Audio (rekam + putar) | `react-native-audio-api` (Software Mansion) | API mirip Web Audio: `AudioRecorder` untuk frame PCM, `AudioContext` untuk pemutaran terjadwal tanpa jeda |
| Izin mikrofon | `react-native-permissions` atau API izin bawaan library audio | Android `RECORD_AUDIO` |
| Encoding | `buffer` (polyfill) | Base64 untuk PCM |
| Validasi | `zod` | Validasi respons model AI & pesan server |
| Layar menyala | `expo-keep-awake` | Layar tidak mati selama telepon |
| Transport Live | `WebSocket` bawaan React Native | Tanpa dependency tambahan |
| Model teks | REST `generateContent` via `fetch` | Sederhana, tanpa SDK |
| UI | StyleSheet / NativeWind (opsional) | Bebas |

Alternatif jika `react-native-audio-api` bermasalah: `@siteed/expo-audio-studio` untuk rekam, atau modul Expo native kecil yang membungkus `AudioRecord`/`AudioTrack` Android.

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
│   ├── audio/
│   │   ├── MicStreamer.ts        # Rekam → resample 16 kHz → Int16 → base64
│   │   ├── PcmPlayer.ts          # base64 → Int16 24 kHz → Float32 → antrean putar
│   │   └── pcm.ts                # Utilitas konversi & resample
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
├── PRD.md
├── ARCHITECTURE.md
├── PROMPTS.md
├── ROADMAP.md
└── CLAUDE.md
```

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

Pesan `setup` pertama (nama field **wajib dicek ulang** dengan referensi API terbaru):

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

- **Model:** pilih model Live yang di halaman pricing tertulis gratis di kolom Free Tier (per November 2026 contohnya keluarga `gemini-3.x-flash-live-preview` / `gemini-2.5-flash-native-audio-preview-*`). Simpan di config, jangan hardcode di banyak tempat.
- **Deteksi suara (VAD):** pakai deteksi otomatis bawaan dulu. Jika guru terlalu cepat memotong saat murid berpikir, atur sensitivitas akhir bicara di `realtimeInputConfig.automaticActivityDetection` — pemula butuh jeda lebih panjang.
- **Durasi:** sesi audio punya batas durasi; `contextWindowCompression` + `sessionResumption` dipakai agar telepon 15–20 menit tidak terputus. Default timer telepon di app: 15 menit, dengan peringatan di menit 13.

### Endpoint & autentikasi

- WebSocket: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=<API_KEY>`
- v1 (pribadi): API key dari Google AI Studio, disimpan di `expo-secure-store`, dimasukkan pengguna di layar onboarding. **Tidak pernah** di-commit atau ditaruh di `.env` yang ikut ke repo.
- Jika suatu saat APK dibagikan: pindah ke *ephemeral token* yang dicetak oleh backend kecil gratis (misalnya Cloudflare Workers free plan), sehingga API key asli tidak ada di APK.

## 6. Pipeline Audio

### Mikrofon → server (`MicStreamer`)
1. `AudioRecorder` menghasilkan frame Float32 pada sample rate perangkat (sering 44,1/48 kHz).
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
1. Aktifkan mode audio komunikasi / echo cancellation jika library mendukung.
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

API key **tidak** disimpan di tabel `settings`, melainkan di `expo-secure-store`.

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
- **Uji manual di HP asli** (emulator sering bermasalah dengan audio): latensi, barge-in, echo dengan speaker vs earphone, telepon 15 menit, mode pesawat di tengah telepon.
- Simpan contoh transkrip di `__fixtures__/` untuk menguji `analyzeSession` tanpa menelepon.
