// "Senin için" akışının sıralama kuralı. SAF fonksiyon; ücretli/harici bir öneri servisi kullanılmaz.
// Puan = etkileşim (beğeni + 2×yorum, logaritmik) + yakınlık (takip, ortak spor ilgisi, doğrulanmış uzman) − yaşlanma.
// Kural açıktır ve açıklanabilir: kişinin sağlık verisi sıralamada hiçbir şekilde kullanılmaz.

export interface RankInput {
  likes: number;
  comments: number;
  ageHours: number;
  followed: boolean;
  sharedSports: number;
  verifiedAuthor: boolean;
  hasMedia: boolean;
  mine: boolean;
}

// Puanın yarıya indiği süre (saat)
export const HALF_LIFE_HOURS = 24;

export function rankScore(p: RankInput): number {
  const engagement = Math.log2(1 + p.likes + 2 * p.comments);
  const affinity = (p.followed ? 2 : 0) + Math.min(p.sharedSports, 3) * 0.75 + (p.verifiedAuthor ? 0.5 : 0) + (p.hasMedia ? 0.25 : 0);
  const decay = Math.pow(0.5, Math.max(0, p.ageHours) / HALF_LIFE_HOURS);
  // Kendi gönderisi genel akışta öne çıkarılmaz
  const self = p.mine ? 0.5 : 1;
  return (1 + engagement + affinity) * decay * self;
}

// Aynı kişinin art arda çok gönderisi akışı kaplamasın: bir kişiden en fazla `perAuthor` gönderi üst üste gelmez
export function spreadAuthors<T extends { authorId: string }>(items: T[], perAuthor = 2): T[] {
  const out: T[] = [];
  const queue = [...items];
  while (queue.length) {
    const idx = queue.findIndex((it) => {
      const tail = out.slice(-perAuthor);
      return !(tail.length === perAuthor && tail.every((t) => t.authorId === it.authorId));
    });
    out.push(...queue.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}
