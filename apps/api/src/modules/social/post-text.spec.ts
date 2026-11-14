import { hashtagsOf, mentionsOf, normalizeTag } from './post-text.js';

describe('gönderi metni', () => {
  it('etiketler Türkçe harfle, tekrarsız ve küçük harfle ayıklanır', () => {
    expect(hashtagsOf('Sabah #Koşu yaptım #sabahKoşusu #koşu')).toEqual(['koşu', 'sabahkoşusu']);
    expect(hashtagsOf('İstanbul#yok ama #İzmir var')).toEqual(['izmir']);
    expect(hashtagsOf('fiyat 5#  &#39; #')).toEqual([]);
    expect(hashtagsOf(null)).toEqual([]);
  });

  it('bahsetmeler kullanıcı adı kuralına göre ayıklanır; e-posta bahsetme sayılmaz', () => {
    expect(mentionsOf('@Ayse_k ile koştuk, @burak. de geldi')).toEqual(['ayse_k', 'burak']);
    expect(mentionsOf('mail: ali@ornek.com @ab')).toEqual([]);
  });

  it('etiket arama terimi düzeltilir', () => {
    expect(normalizeTag('  #Koşu ')).toBe('koşu');
  });
});
