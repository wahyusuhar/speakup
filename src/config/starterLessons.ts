// Built-in lessons used by the temporary starterCall (PROMPTS.md §0) until the
// curriculum (Phase 5) exists. Content lives here, not in the prompt text.
// Titles and meanings are Indonesian (spoken by the tutor); `en` is the item practised.

export type StarterItem = {
  /** English word or sentence the student practises. "..." marks a slot the student fills. */
  en: string;
  /** Indonesian meaning. */
  id: string;
};

export type StarterPart = { title: string; items: StarterItem[] };

/** beginner: indonesian_support full/high. conversation: low/none. */
export type StarterTrack = 'beginner' | 'conversation';

export type StarterLesson = {
  key: string;
  track: StarterTrack;
  title: string;
  parts: StarterPart[];
};

/** A starter call counts as a finished lesson (rotation moves on) only if it lasted this long. */
export const STARTER_LESSON_MIN_SEC = 180;

/** Order matters: beginner lessons are taken in this order, then repeat from the first. */
export const STARTER_LESSONS: readonly StarterLesson[] = [
  {
    key: 'greetings_intro',
    track: 'beginner',
    title: 'Salam dan memperkenalkan diri',
    parts: [
      {
        title: 'Kosakata salam',
        items: [
          { en: 'Hello', id: 'Halo' },
          { en: 'Good morning', id: 'Selamat pagi' },
          { en: 'Good afternoon', id: 'Selamat siang' },
          { en: 'Good evening', id: 'Selamat malam' },
          { en: 'Goodbye', id: 'Sampai jumpa' },
        ],
      },
      {
        title: 'Kata kerja',
        items: [
          { en: 'live', id: 'tinggal' },
          { en: 'work', id: 'bekerja' },
          { en: 'like', id: 'suka' },
        ],
      },
      {
        title: 'Latihan kalimat',
        items: [
          { en: 'My name is ...', id: 'Nama saya ...' },
          { en: 'I live in ...', id: 'Saya tinggal di ...' },
          { en: 'I like ...', id: 'Saya suka ...' },
          { en: 'Nice to meet you', id: 'Senang berkenalan denganmu' },
        ],
      },
    ],
  },
  {
    key: 'courtesy',
    track: 'beginner',
    title: 'Kata sopan santun',
    parts: [
      {
        title: 'Kata sopan',
        items: [
          { en: 'Please', id: 'Tolong / silakan' },
          { en: 'Thank you', id: 'Terima kasih' },
          { en: 'Sorry', id: 'Maaf' },
          { en: 'Excuse me', id: 'Permisi' },
        ],
      },
      {
        title: 'Jawaban sopan',
        items: [
          { en: "You're welcome", id: 'Sama-sama' },
          { en: 'No problem', id: 'Tidak masalah' },
        ],
      },
      {
        title: 'Latihan kalimat',
        items: [
          { en: 'Excuse me, can you help me?', id: 'Permisi, bisa bantu saya?' },
          { en: "Sorry, I don't understand.", id: 'Maaf, saya tidak mengerti.' },
          { en: 'Can you say that again, please?', id: 'Bisa diulangi, tolong?' },
          { en: 'Thank you very much.', id: 'Terima kasih banyak.' },
        ],
      },
    ],
  },
  {
    key: 'numbers_age',
    track: 'beginner',
    title: 'Angka 1 sampai 10 dan umur',
    parts: [
      {
        title: 'Angka 1 sampai 5',
        items: [
          { en: 'one', id: 'satu' },
          { en: 'two', id: 'dua' },
          { en: 'three', id: 'tiga' },
          { en: 'four', id: 'empat' },
          { en: 'five', id: 'lima' },
        ],
      },
      {
        title: 'Angka 6 sampai 10',
        items: [
          { en: 'six', id: 'enam' },
          { en: 'seven', id: 'tujuh' },
          { en: 'eight', id: 'delapan' },
          { en: 'nine', id: 'sembilan' },
          { en: 'ten', id: 'sepuluh' },
        ],
      },
      {
        title: 'Latihan kalimat',
        items: [
          { en: 'How old are you?', id: 'Berapa umurmu?' },
          { en: 'I am ... years old.', id: 'Umur saya ... tahun.' },
          { en: 'I have ...', id: 'Saya punya ...' },
        ],
      },
    ],
  },
  {
    key: 'daily_activities',
    track: 'beginner',
    title: 'Kegiatan sehari-hari',
    parts: [
      {
        title: 'Kata kerja',
        items: [
          { en: 'wake up', id: 'bangun tidur' },
          { en: 'eat', id: 'makan' },
          { en: 'drink', id: 'minum' },
          { en: 'work', id: 'bekerja' },
          { en: 'sleep', id: 'tidur' },
        ],
      },
      {
        title: 'Keterangan waktu',
        items: [
          { en: 'in the morning', id: 'di pagi hari' },
          { en: 'in the afternoon', id: 'di siang hari' },
          { en: 'at night', id: 'di malam hari' },
        ],
      },
      {
        title: 'Latihan kalimat',
        items: [
          { en: 'I wake up at six.', id: 'Saya bangun jam enam.' },
          { en: 'I eat breakfast in the morning.', id: 'Saya sarapan di pagi hari.' },
          { en: 'I sleep at night.', id: 'Saya tidur di malam hari.' },
        ],
      },
    ],
  },
  {
    key: 'daily_routine_talk',
    track: 'conversation',
    title: 'Ngobrol tentang rutinitas harian',
    parts: [
      {
        title: 'Frasa berguna',
        items: [
          { en: 'I usually ...', id: 'Biasanya saya ...' },
          { en: 'On weekdays, ...', id: 'Pada hari kerja, ...' },
          { en: 'On weekends, ...', id: 'Pada akhir pekan, ...' },
          { en: 'After work, I ...', id: 'Setelah kerja, saya ...' },
        ],
      },
      {
        title: 'Pertanyaan',
        items: [
          { en: 'What does a normal day look like for you?', id: 'Seperti apa harimu biasanya?' },
          { en: 'What is the best part of your day?', id: 'Bagian terbaik dari harimu apa?' },
        ],
      },
      {
        title: 'Cerita bebas',
        items: [{ en: 'Tell me about your last weekend.', id: 'Ceritakan akhir pekanmu yang lalu.' }],
      },
    ],
  },
];
