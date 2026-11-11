// Başlangıç yemek listesi (Türk mutfağı ağırlıklı). Değerler porsiyon başına ve TAHMİNİDİR.
// Gerçek yayında bu liste veritabanına (Food, FoodPortion) aktarılır; bir diyetisyen düzeltince "doğrulanmış" olur.
import type { Allergen, FoodItem, MealSlot } from '../nutrition';

const SLOT_CODES: Record<string, MealSlot> = { b: 'breakfast', l: 'lunch', s: 'snack', d: 'dinner' };
const DIET_CODES = { v: 'vegan', t: 'vegetarian', o: 'omnivore' } as const;

// slots/mains: b=kahvaltı, l=öğle, s=ara öğün, d=akşam. diet: v=vegan, t=vejetaryen, o=hepçil
function food(
  id: string,
  name: string,
  portion: string,
  grams: number,
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
  slots: string,
  mains: string,
  allergens: Allergen[],
  diet: keyof typeof DIET_CODES,
  allergenInfoComplete = true,
): FoodItem {
  const toSlots = (codes: string) => codes.split('').map((c) => SLOT_CODES[c]!);
  return {
    id,
    name,
    portion,
    grams,
    kcal,
    proteinG,
    carbsG,
    fatG,
    slots: toSlots(slots),
    mainIn: toSlots(mains),
    allergens,
    allergenInfoComplete,
    diet: DIET_CODES[diet],
    isEstimate: true,
  };
}

export const SEED_FOODS: readonly FoodItem[] = [
  // Kahvaltı
  food('omlet', 'Peynirli omlet', '2 yumurtalı, 1 porsiyon', 150, 260, 18, 2, 20, 'b', 'b', ['egg', 'milk'], 't'),
  food('menemen', 'Menemen', '1 porsiyon', 220, 220, 11, 9, 16, 'b', 'b', ['egg'], 't'),
  food('yulaf-sut', 'Sütlü yulaf ezmesi', '1 kase', 250, 290, 12, 44, 8, 'b', 'b', ['gluten', 'milk'], 't'),
  food('yulaf-vegan', 'Muzlu yulaf (bitkisel süt)', '1 kase', 250, 270, 8, 48, 6, 'b', 'b', ['gluten'], 'v'),
  food('yumurta-hasli', 'Haşlanmış yumurta', '2 adet', 100, 155, 13, 1, 11, 'b', 'b', ['egg'], 't'),
  food('borek', 'Ev böreği (içeriği bilinmiyor)', '1 dilim', 120, 260, 8, 24, 15, 'b', 'b', [], 't', false),
  food('ekmek-tam-bugday', 'Tam buğday ekmeği', '2 dilim', 60, 160, 6, 30, 2, 'bld', '', ['gluten'], 'v'),
  food('beyaz-peynir', 'Beyaz peynir', '2 dilim', 40, 105, 6, 1, 9, 'b', '', ['milk'], 't'),
  food('zeytin', 'Zeytin', '6 adet', 25, 45, 0, 1, 4, 'b', '', [], 'v'),
  food('domates-salatalik', 'Domates ve salatalık', '1 tabak', 200, 35, 2, 7, 0, 'bld', '', [], 'v'),
  food('bal', 'Bal', '1 tatlı kaşığı', 10, 45, 0, 12, 0, 'b', '', [], 't'),
  food('patates-hasli', 'Haşlanmış patates', '1 orta', 150, 130, 3, 30, 0, 'bld', '', [], 'v'),
  food('sut', 'Süt', '1 bardak', 200, 120, 8, 12, 5, 'bs', '', ['milk'], 't'),
  food('sizme-yogurt', 'Süzme yoğurt', '1 kase', 150, 130, 14, 8, 4, 'blds', 's', ['milk'], 't'),

  // Ara öğün (aynı zamanda kahvaltıda yan yemek)
  food('elma', 'Elma', '1 orta', 180, 95, 0, 25, 0, 'bs', 's', [], 'v'),
  food('muz', 'Muz', '1 orta', 120, 105, 1, 27, 0, 'bs', 's', [], 'v'),
  food('ceviz', 'Ceviz', '3 adet', 20, 130, 3, 3, 13, 'bs', '', ['tree_nut'], 'v'),
  food('kuru-kayisi', 'Kuru kayısı', '5 adet', 40, 80, 1, 20, 0, 'bs', '', [], 'v'),
  food('meyve-tabagi', 'Meyve tabağı', '1 porsiyon', 200, 120, 1, 30, 0, 'lds', 's', [], 'v'),
  food('badem', 'Badem', '10 adet', 12, 70, 3, 3, 6, 's', '', ['tree_nut'], 'v'),
  food('fistik-ezmeli-elma', 'Fıstık ezmeli elma', '1 elma, 1 yemek kaşığı', 200, 190, 4, 28, 8, 's', 's', ['peanut'], 'v'),
  food('havuc-humus', 'Havuç çubukları ve humus', '1 porsiyon', 150, 130, 5, 14, 7, 's', 's', ['sesame'], 'v'),
  food('kefir', 'Kefir', '1 bardak', 200, 100, 6, 8, 4, 's', '', ['milk'], 't'),
  food('peynirli-kraker', 'Peynirli kraker', '1 porsiyon', 40, 150, 5, 17, 7, 's', '', ['gluten', 'milk'], 't'),

  // Öğle ve akşam ana yemekleri
  food('tavuk-izgara', 'Izgara tavuk göğsü', '150 g', 150, 250, 45, 0, 6, 'ld', 'ld', [], 'o'),
  food('kofte', 'Izgara köfte', '4 adet', 130, 330, 26, 8, 21, 'ld', 'ld', ['gluten', 'egg'], 'o'),
  food('karniyarik', 'Karnıyarık', '1 porsiyon', 250, 380, 15, 22, 26, 'ld', 'ld', [], 'o'),
  food('kuru-fasulye', 'Kuru fasulye', '1 porsiyon', 250, 300, 15, 45, 6, 'ld', 'ld', [], 'v'),
  food('nohut', 'Nohut yemeği', '1 porsiyon', 250, 270, 14, 45, 4, 'ld', 'ld', [], 'v'),
  food('tavuk-sote', 'Sebzeli tavuk sote', '1 porsiyon', 250, 290, 28, 14, 14, 'ld', 'ld', [], 'o'),
  food('ton-salata', 'Ton balıklı salata', '1 tabak', 250, 210, 24, 6, 10, 'ld', 'ld', ['fish'], 'o'),
  food('makarna', 'Domates soslu makarna', '1 tabak', 250, 330, 11, 65, 2, 'ld', 'ld', ['gluten'], 'v'),
  food('mercimek-corba', 'Mercimek çorbası', '1 kase', 250, 180, 10, 28, 3, 'ld', 'ld', [], 'v'),
  food('yesil-mercimek', 'Yeşil mercimek yemeği', '1 porsiyon', 250, 240, 14, 38, 3, 'ld', 'ld', [], 'v'),
  food('somon', 'Fırında somon', '150 g', 150, 310, 34, 0, 19, 'ld', 'd', ['fish'], 'o'),

  // Yan yemekler
  food('ezogelin', 'Ezogelin çorbası', '1 kase', 250, 190, 8, 30, 4, 'ld', '', ['gluten'], 'v'),
  food('pilav', 'Pirinç pilavı', '1 kase', 150, 205, 4, 45, 1, 'ld', '', [], 'v'),
  food('bulgur', 'Bulgur pilavı', '1 kase', 150, 150, 5, 33, 1, 'ld', '', ['gluten'], 'v'),
  food('mevsim-salata', 'Mevsim salata', '1 tabak', 200, 90, 2, 8, 6, 'ld', '', [], 'v'),
  food('cacik', 'Cacık', '1 kase', 150, 90, 5, 6, 5, 'ld', '', ['milk'], 't'),
  food('ayran', 'Ayran', '1 bardak', 200, 70, 4, 5, 3, 'ld', '', ['milk'], 't'),
  food('zeytinyagli-sebze', 'Zeytinyağlı sebze yemeği', '1 porsiyon', 200, 160, 3, 14, 11, 'ld', '', [], 'v'),
  food('taze-fasulye', 'Zeytinyağlı taze fasulye', '1 porsiyon', 200, 150, 3, 12, 10, 'ld', '', [], 'v'),
  food('humus', 'Humus', '3 yemek kaşığı', 60, 120, 5, 10, 7, 'ld', '', ['sesame'], 'v'),
  food('sutlac', 'Sütlaç', '1 kase', 150, 260, 7, 45, 6, 'ld', '', ['milk'], 't'),
];

export function findFood(id: string): FoodItem | undefined {
  return SEED_FOODS.find((f) => f.id === id);
}
