# PRD — SpeakUp (nama kerja)

Aplikasi Android belajar bahasa Inggris dengan AI yang berperan sebagai **guru privat**, dengan **fitur telepon** (percakapan suara realtime) sebagai inti pengalaman belajar.

| | |
|---|---|
| Pemilik | Wahyu Suhardiyono |
| Status | Draft v1 |
| Tanggal | 5 November 2026 |
| Platform | Android (APK, dipakai pribadi) |
| Biaya | Rp0 — seluruh komponen wajib gratis |

---

## 1. Latar Belakang

Pemilik ingin menguasai bahasa Inggris tanpa ikut kursus. Aplikasi chat AI umum bisa diajak latihan, tetapi tidak berperilaku seperti guru: tidak mengukur level, tidak menyusun kurikulum, tidak mengingat kesalahan yang berulang, dan tidak merancang materi berikutnya berdasarkan kemajuan.

SpeakUp mengisi celah itu: **guru privat yang bisa ditelepon kapan saja**, yang ingat kemajuan muridnya dan menyesuaikan materi dari sesi ke sesi.

## 2. Tujuan

1. Pengguna bisa latihan berbicara bahasa Inggris lewat **telepon suara realtime** dengan AI guru.
2. AI mengukur level awal pengguna dan menyusun **kurikulum bertahap** sesuai level.
3. Setiap sesi menghasilkan **koreksi** (grammar, kosakata, pelafalan) dan **rencana sesi berikutnya**.
4. Kemajuan tersimpan dan terlihat, sehingga pengguna termotivasi.
5. Seluruh pengembangan dan pemakaian **tanpa biaya**.

### Bukan tujuan (v1)

- Bukan aplikasi publik / Play Store (dipakai pribadi dulu).
- Tidak ada akun pengguna, login, atau sinkronisasi cloud.
- Tidak ada iOS.
- Tidak ada fitur sosial, leaderboard, atau pembayaran.
- Tidak ada penilaian pelafalan berbasis skor fonetik presisi (hanya umpan balik dari AI).

## 3. Pengguna

**Persona utama: pemula dewasa Indonesia.**
- Paham teknologi, tetapi kemampuan bahasa Inggris rendah (level awal kira-kira A1–A2).
- Malu atau ragu berbicara bahasa Inggris dengan orang.
- Punya waktu belajar tidak tetap, sesi pendek 10–20 menit.
- Butuh penjelasan dalam bahasa Indonesia di awal, lalu bertahap ke bahasa Inggris penuh.

## 4. Pengalaman Inti

```
Buka app pertama kali
  → Onboarding: isi self-assessment + tujuan belajar
  → Telepon placement (5–7 menit) → AI menentukan level CEFR
  → AI menyusun kurikulum awal
  → Beranda: "Pelajaran hari ini" + tombol TELEPON GURU
  → Telepon pelajaran (10–20 menit, suara realtime)
  → Tutup telepon → Laporan sesi (koreksi, kosakata, skor)
  → AI memperbarui progres & menyiapkan pelajaran berikutnya
  → Kembali ke Beranda
```

## 5. Fitur

Prioritas: **P0** wajib untuk MVP, **P1** penting setelah MVP, **P2** nanti.

### F1. Onboarding & Self-Assessment — P0
- Pengguna mengisi: perkiraan kemampuan (pilihan: "Hampir nol", "Dasar", "Menengah", "Lancar"), tujuan belajar (kerja, interview, ngobrol sehari-hari, dll.), target waktu per hari.
- Data ini menjadi konteks awal guru.
- **Diterima jika:** data tersimpan di SQLite dan dipakai di prompt placement.

### F2. Telepon Guru (fitur utama) — P0
- Layar panggilan bergaya telepon: nama/avatar guru, status ("Menyambungkan…", "Guru berbicara", "Mendengarkan"), timer durasi, tombol **Mute**, **Speaker**, **Tutup**.
- Percakapan suara dua arah realtime via Gemini Live API.
- **Barge-in:** pengguna bisa memotong guru di tengah kalimat; audio guru langsung berhenti.
- Indikator visual saat pengguna berbicara (level mikrofon) dan saat guru berbicara.
- Transkrip suara pengguna dan guru direkam di latar belakang (tidak wajib ditampilkan saat telepon).
- Mode teks opsional selama telepon: tombol "Lihat teks" untuk menampilkan subtitle (P1).
- Jika koneksi terputus: tampilkan pesan, simpan transkrip yang sudah ada, tawarkan sambung ulang.
- **Diterima jika:** jeda dari pengguna selesai bicara sampai guru mulai menjawab terasa wajar (target < 1,5 detik di jaringan 4G), barge-in bekerja, dan transkrip tersimpan setelah telepon ditutup.

### F3. Placement Test via Telepon — P0
- Telepon khusus 5–7 menit. Guru bertanya bertahap dari mudah ke sulit.
- Setelah selesai, transkrip dianalisis model teks → level CEFR (A1–C2) + kekuatan & kelemahan.
- **Diterima jika:** level dan ringkasan tersimpan, dan pengguna melihat hasilnya dalam bahasa Indonesia.

### F4. Kurikulum Adaptif — P0
- AI menyusun daftar unit pelajaran (misalnya 8–12 unit untuk level saat ini), tiap unit punya tujuan, kosakata target, dan pola grammar target.
- Setelah tiap sesi, AI bisa: menandai unit selesai, mengulang unit, atau menyisipkan unit remedial berdasarkan kesalahan berulang.
- **Diterima jika:** Beranda selalu menampilkan satu "Pelajaran hari ini" yang berasal dari kurikulum.

### F5. Laporan Sesi (koreksi) — P0
- Muncul otomatis setelah telepon ditutup (proses analisis beberapa detik).
- Isi: ringkasan sesi, daftar kesalahan (kalimat asli → koreksi → penjelasan singkat dalam bahasa Indonesia), kosakata baru, skor (fluency, grammar, vocabulary; 1–5), dan saran untuk sesi berikutnya.
- **Diterima jika:** laporan tersimpan dan bisa dibuka lagi dari Riwayat.

### F6. Memori Guru — P0
- Ringkasan profil murid (level, kesalahan berulang, kosakata yang sudah dikuasai, topik yang disukai) disisipkan ke system prompt setiap telepon.
- **Diterima jika:** guru menyebut atau melatih ulang kesalahan dari sesi sebelumnya tanpa diminta.

### F7. Progres — P1
- Grafik sederhana skor per sesi, total menit berbicara, streak harian, jumlah kosakata.

### F8. Bank Kosakata & Review — P1
- Daftar kosakata dari laporan sesi. Review ringan (flashcard) memakai spaced repetition sederhana.

### F9. Riwayat Sesi — P1
- Daftar sesi lama: tanggal, durasi, topik, skor; bisa membuka laporan dan transkrip.

### F10. Pengaturan — P0 (minimal)
- Isi/ubah API key Gemini.
- Pilih suara guru, kecepatan bicara ("pelan" / "normal"), porsi bahasa Indonesia ("banyak" / "sedikit" / "tidak ada").
- Reset progres.

### F11. Pengingat Harian — P2
- Notifikasi lokal pada jam yang dipilih.

## 6. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| Biaya | Tidak ada layanan berbayar. Hanya free tier Gemini API + tool open source. |
| Privasi | Semua data progres disimpan lokal di HP (SQLite). Audio tidak disimpan, hanya transkrip teks. |
| Keamanan key | API key disimpan di `expo-secure-store`, tidak di-commit ke repo. |
| Kinerja | Audio tanpa putus-putus (gapless), latensi respons wajar di 4G. |
| Keandalan | Menangani putus koneksi, batas kuota (HTTP 429 / sesi ditolak), dan batas durasi sesi Live API. |
| Kompatibilitas | Android 10+ (API 29+). |
| Bahasa UI | Bahasa Indonesia. |

## 7. Batasan & Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Batas kuota free tier Gemini | Telepon gagal saat kuota habis | Tampilkan pesan jelas + waktu coba lagi; batasi durasi telepon default 15 menit. |
| Model Live berstatus *preview* — nama/perilaku bisa berubah | Kode koneksi rusak | Nama model disimpan di satu file config; cek ulang dokumentasi tiap update. |
| Batas durasi sesi Live API | Telepon terputus otomatis | Gunakan *context window compression* + *session resumption*; batasi telepon di bawah batas. |
| Data free tier dipakai Google untuk pengembangan produk | Privasi | Peringatan di onboarding: jangan menyebut data pribadi sensitif saat sesi. |
| API key tertanam di APK | Key bisa dicuri jika APK dibagikan | APK hanya untuk pribadi. Jika dibagikan nanti, pindah ke *ephemeral token* lewat backend gratis (lihat ARCHITECTURE.md). |
| Streaming audio PCM di React Native | Kompleks secara teknis | Pakai `react-native-audio-api` di dev build; prototipe audio dikerjakan paling awal. |

## 8. Metrik Keberhasilan (pribadi)

- Rutin: ≥ 5 telepon per minggu selama 2 bulan pertama.
- Kemajuan: naik minimal satu sub-level CEFR (misalnya A1 → A2) dalam 3 bulan berdasarkan placement ulang.
- Teknis: ≥ 90% telepon selesai tanpa error.

## 9. Rilis

| Versi | Isi |
|---|---|
| v0.1 — Prototipe | F2 dasar: tombol telepon, ngobrol suara dengan Gemini Live, barge-in. |
| v0.5 — MVP | F1, F2, F3, F4, F5, F6, F10. |
| v1.0 | + F7, F8, F9, subtitle saat telepon. |
| v1.x | F11, placement ulang berkala, mode skenario (interview, restoran, dll.). |

Detail pengerjaan per fase ada di `ROADMAP.md`.
