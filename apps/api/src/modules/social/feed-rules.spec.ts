import { rankScore, spreadAuthors, type RankInput } from './feed-rules.js';

const base: RankInput = { likes: 0, comments: 0, ageHours: 1, followed: false, sharedSports: 0, verifiedAuthor: false, hasMedia: false, mine: false };

describe('akış sıralaması', () => {
  it('etkileşim, takip ve ortak ilgi puanı artırır; zaman azaltır', () => {
    expect(rankScore({ ...base, likes: 10 })).toBeGreaterThan(rankScore(base));
    expect(rankScore({ ...base, comments: 5 })).toBeGreaterThan(rankScore({ ...base, likes: 5 }));
    expect(rankScore({ ...base, followed: true })).toBeGreaterThan(rankScore({ ...base, sharedSports: 1 }));
    expect(rankScore({ ...base, ageHours: 48 })).toBeCloseTo(rankScore({ ...base, ageHours: 0 }) / 4, 5);
    expect(rankScore({ ...base, mine: true })).toBeLessThan(rankScore(base));
    // Ortak ilgi 3 branşta sınırlanır
    expect(rankScore({ ...base, sharedSports: 10 })).toBe(rankScore({ ...base, sharedSports: 3 }));
  });

  it('aynı kişinin gönderileri üst üste en fazla iki kez gelir', () => {
    const items = ['a', 'a', 'a', 'a', 'b', 'c'].map((authorId, i) => ({ authorId, i }));
    const out = spreadAuthors(items).map((x) => x.authorId);
    expect(out).toEqual(['a', 'a', 'b', 'a', 'a', 'c']);
    expect(spreadAuthors([{ authorId: 'a' }, { authorId: 'a' }, { authorId: 'a' }]).length).toBe(3);
  });
});
