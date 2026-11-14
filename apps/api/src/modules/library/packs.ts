// 28 günlük paketler: her günü Antrenmanlar'daki bir karta bağlı tematik programlar. Mevcut program altyapısı (katılma, Görevlerim, tamamlama) aynen çalışır.
// Başlıklarda sonuç vaadi yoktur ("yağ eritir" gibi iddialar kullanılmaz); sonuçlar kişiden kişiye değişir.
// Şimdilik hepsi ücretsiz; ücretli olacaklar sonradan seçilir.
import { PROGRAMS, type ItemCategory, type Level, type LibraryProgram, type ProgramDayDef } from './catalog.js';
import { workText } from './library-rules.js';
import { findCard, resolveCard } from './workout-cards.js';

interface PackSpec {
  id: string;
  title: string;
  description: string;
  goal: string;
  hero: string;
  category: ItemCategory;
  level: Level;
  // 4 hafta; her hafta aynı sayıda antrenman günü (kart kimlikleri), kalan günler dinlenme
  weeks: [string[], string[], string[], string[]];
}

const SPECS: PackSpec[] = [
  {
    id: 'pack-guclu-kollar', title: '28 Günde Daha Güçlü Kollar', description: 'Kol, omuz ve göğüs hareketleriyle haftada 4 antrenman. Her hafta biraz daha zorlayıcı.', goal: 'Kol kuvveti', hero: 'arms', category: 'home', level: 'beginner',
    weeks: [
      ['arms-beginner', 'shoulder-beginner', 'arms-beginner', 'chest-beginner'],
      ['arms-band', 'shoulder-beginner', 'arms-beginner', 'chest-home'],
      ['arms-dumbbell', 'shoulder-dumbbell', 'arms-band', 'back-home'],
      ['arms-dumbbell', 'shoulder-dumbbell', 'arms-dumbbell', 'chest-dumbbell'],
    ],
  },
  {
    id: 'pack-karin', title: '28 Günde Karın Bölgeni Güçlendir', description: 'Karın ve core antrenmanları, hafif kardiyo ve pilates ile haftada 5 gün.', goal: 'Karın ve core kuvveti', hero: 'core', category: 'home', level: 'beginner',
    weeks: [
      ['core-beginner', 'cardio-low', 'core-beginner', 'posture-hip-back', 'core-beginner'],
      ['core-beginner', 'cardio-low', 'core-mid', 'pilates-start', 'core-beginner'],
      ['core-mid', 'cardio-low', 'core-mid', 'pilates-start', 'core-mid'],
      ['core-mid', 'cardio-low', 'core-advanced', 'pilates-mid', 'core-advanced'],
    ],
  },
  {
    id: 'pack-kalca', title: '28 Günde Kalça ve Glute Programı', description: 'Kalça ve bacak güçlendirme, aralarda mobilite ve esneme. Haftada 4 antrenman.', goal: 'Kalça kuvveti', hero: 'hip', category: 'home', level: 'beginner',
    weeks: [
      ['hip-beginner', 'legs-beginner', 'hip-beginner', 'mobility-morning'],
      ['hip-band', 'legs-band', 'hip-beginner', 'posture-hip-back'],
      ['hip-mid', 'legs-home', 'hip-band', 'yoga-flex'],
      ['hip-mid', 'legs-dumbbell', 'hip-mid', 'yoga-flex'],
    ],
  },
  {
    id: 'pack-yuz', title: '28 Günde Yüz Egzersizi Programı', description: 'Sabah egzersiz, akşam masaj rutinleri ve bölgesel çalışmalar. Etkisi için bilimsel kanıt sınırlıdır; sonuç garanti edilmez.', goal: 'Yüz egzersizi ve rahatlama', hero: 'face', category: 'face', level: 'beginner',
    weeks: [
      ['face-morning', 'face-evening', 'face-morning', 'face-evening', 'face-morning'],
      ['face-morning', 'face-yanak-ex', 'face-evening', 'face-goz-ex', 'face-morning'],
      ['face-jaw-neck', 'face-yanak-ex', 'face-evening', 'face-alin-ex', 'face-morning'],
      ['face-jaw-neck', 'face-tum-ex', 'face-evening', 'face-dudak-ex', 'face-morning'],
    ],
  },
  {
    id: 'pack-durus', title: '28 Günde Duruşunu Geliştir', description: 'Masa başı çalışanlar için boyun, omuz, sırt ve kalça hareketleri. Haftada 5 kısa antrenman.', goal: 'Duruşu iyileştirmek', hero: 'posture', category: 'posture', level: 'beginner',
    weeks: [
      ['posture-desk', 'posture-neck', 'posture-short', 'posture-hip-back', 'posture-desk'],
      ['posture-neck', 'posture-upper-back', 'posture-short', 'posture-hip-back', 'posture-desk'],
      ['posture-upper-back', 'back-beginner', 'posture-neck', 'posture-hip-back', 'posture-upper-back'],
      ['posture-upper-back', 'back-beginner', 'posture-neck', 'yoga-flex', 'posture-upper-back'],
    ],
  },
  {
    id: 'pack-esneklik', title: '28 Günde Esneklik ve Gevşeme', description: 'Yoga, mobilite ve nefes çalışmalarıyla yumuşak başlangıç. Haftada 5 gün.', goal: 'Esneklik ve rahatlama', hero: 'yoga', category: 'mobility', level: 'beginner',
    weeks: [
      ['yoga-calm', 'mobility-morning', 'yoga-calm', 'yoga-relax', 'yoga-flex'],
      ['yoga-flex', 'mobility-morning', 'yoga-calm', 'yoga-relax', 'yoga-flex'],
      ['yoga-flow-mid', 'yoga-flex', 'mobility-morning', 'yoga-relax', 'yoga-flow-mid'],
      ['yoga-flow-mid', 'yoga-flex', 'pilates-start', 'yoga-relax', 'yoga-flow-mid'],
    ],
  },
  {
    id: 'pack-baslangic', title: '28 Günde Başlangıç: Tüm Vücut', description: 'Hiç spor yapmamış olanlar için sandalyeli başlangıçtan dambıllıya yavaş ilerleyen tüm vücut programı.', goal: 'Hareket alışkanlığı kazanmak', hero: 'fullbody', category: 'home', level: 'beginner',
    weeks: [
      ['chair-start', 'quick-10', 'chair-start', 'cardio-low'],
      ['fullbody-home', 'quick-10', 'fullbody-home', 'cardio-low'],
      ['fullbody-home', 'core-beginner', 'fullbody-home', 'cardio-low'],
      ['fullbody-dumbbell', 'core-beginner', 'fullbody-home', 'cardio-low'],
    ],
  },
  {
    id: 'pack-sirt-omuz', title: '28 Günde Güçlü Sırt ve Omuz', description: 'Sırt, omuz ve duruş hareketleri; haftada 4 antrenman.', goal: 'Sırt ve omuz kuvveti', hero: 'back', category: 'home', level: 'beginner',
    weeks: [
      ['back-beginner', 'shoulder-beginner', 'back-beginner', 'posture-upper-back'],
      ['back-home', 'shoulder-beginner', 'back-beginner', 'posture-upper-back'],
      ['back-dumbbell', 'shoulder-dumbbell', 'back-home', 'posture-neck'],
      ['back-dumbbell', 'shoulder-dumbbell', 'back-dumbbell', 'posture-neck'],
    ],
  },
];

// Kartın adımları: tüm bölümlerin hareketleri sırayla (kısıtsız)
function dayFor(cardId: string): ProgramDayDef {
  const card = findCard(cardId);
  if (!card) throw new Error(`Paket kartı bulunamadı: ${cardId}`);
  const r = resolveCard(card, [], workText);
  return { title: card.title, cardId, steps: r.sections.flatMap((s) => s.items).map((i) => ({ itemId: i.itemId, work: i.work, restAfterSec: i.restAfterSec })) };
}

export const PACKS: LibraryProgram[] = SPECS.map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  category: s.category,
  level: s.level,
  weeks: 4,
  daysPerWeek: s.weeks[0].length,
  access: 'FREE' as const,
  kind: 'PACK' as const,
  hero: s.hero,
  goal: s.goal,
  days: s.weeks.flat().map(dayFor),
}));

// Mevcut klasik programların liste görseli ve hedefi
const PROGRAM_META: Record<string, { hero: string; goal: string }> = {
  'ev-baslangic': { hero: 'fullbody', goal: 'Temel güç ve dayanıklılık' },
  'masa-basi-durus': { hero: 'posture', goal: 'Duruşu iyileştirmek' },
  'yuz-masaji-rutini': { hero: 'face', goal: 'Rahatlama' },
  'salon-baslangic': { hero: 'legs', goal: 'Salona başlangıç' },
};

export const ALL_PROGRAMS: LibraryProgram[] = [
  ...PACKS,
  ...PROGRAMS.map((p) => ({ ...p, kind: 'PROGRAM' as const, hero: PROGRAM_META[p.id]?.hero ?? 'fullbody', goal: PROGRAM_META[p.id]?.goal ?? '' })),
];

export const findAnyProgram = (id: string) => ALL_PROGRAMS.find((p) => p.id === id);
