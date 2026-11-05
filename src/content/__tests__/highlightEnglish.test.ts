import { highlightEnglish, phrasePattern } from '../highlightEnglish';

const english = (text: string, items: string[]) =>
  highlightEnglish(text, items)
    .filter((s) => s.english)
    .map((s) => s.text);

describe('highlightEnglish', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(english('Coba tirukan ya:   GOOD    morning!  Artinya selamat pagi.', ['Good morning'])).toEqual([
      'GOOD    morning',
    ]);
    expect(english('Bilang "thank-you"? Bukan, thank you.', ['Thank you'])).toEqual(['thank-you', 'thank you']);
  });

  it('keeps the original text and order in segments', () => {
    const segs = highlightEnglish('Sekarang: Hello, Mas!', ['hello']);
    expect(segs.map((s) => s.text).join('')).toBe('Sekarang: Hello, Mas!');
    expect(segs).toEqual([
      { text: 'Sekarang: ', english: false },
      { text: 'Hello', english: true },
      { text: ', Mas!', english: false },
    ]);
  });

  it('prefers the longest item', () => {
    expect(english('Thank you very much, Mas.', ['Thank you', 'Thank you very much.'])).toEqual([
      'Thank you very much',
    ]);
  });

  it('matches words only, not parts of words', () => {
    expect(english('Kita belajar sekarang, bukan tentang ten.', ['one', 'ten'])).toEqual(['ten']);
    expect(english('Toneladas', ['one'])).toEqual([]);
  });

  it('handles "..." slots in the middle, not at the edges', () => {
    expect(phrasePattern('My name is ...')).toEqual(['my', 'name', 'is']);
    expect(english('Coba: I am thirty two years old. Bagus!', ['I am ... years old.'])).toEqual([
      'I am thirty two years old',
    ]);
    expect(english('My name is ... artinya nama saya', ['My name is ...'])).toEqual(['My name is']);
    expect(english('I am years old', ['I am ... years old.'])).toEqual([]);
  });

  it("treats curly and straight apostrophes alike", () => {
    expect(english('Jawabnya: You’re welcome.', ["You're welcome"])).toEqual(['You’re welcome']);
  });

  it('merges adjacent items into one range', () => {
    expect(english('Ulangi: Hello, good morning.', ['Hello', 'Good morning'])).toEqual(['Hello, good morning']);
  });

  it('returns plain text when nothing matches or no items', () => {
    expect(highlightEnglish('Halo Mas', [])).toEqual([{ text: 'Halo Mas', english: false }]);
    expect(highlightEnglish('', ['hello'])).toEqual([]);
  });
});
