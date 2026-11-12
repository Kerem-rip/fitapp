// Kişinin alerjileri ve beslenme tercihi: sağlık öyküsündeki yanıtlar (sunucu).
// Yemek ekleme uyarısı, öğün listesi ve örnek menü bu tek kaynağı kullanır. Değiştirmek de bu yanıtları günceller;
// böylece profil ve kişinin bilgi paylaştığı diyetisyen aynı bilgiyi görür.
import { ALLERGENS, type Allergen, type DietPreference } from '@fitapp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';

const ALLERGY_KEY = 'std.allergies';
const DIET_KEY = 'std.diet_preference';

export function useMyNutritionPrefs() {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  // Sağlık öyküsündeki tercih; "Diğer" seçildiyse menü özel bir kısıt uygulamaz
  const [diet, setDiet] = useState<DietPreference | 'other'>('none');

  const reload = useCallback(async () => {
    try {
      const res = await api.myAnamnesis();
      const value = (key: string) => res.questions.find((q) => q.key === key)?.answer?.value;
      const a = value(ALLERGY_KEY);
      setAllergens(Array.isArray(a) ? a.filter((v): v is Allergen => (ALLERGENS as string[]).includes(String(v))) : []);
      const d = value(DIET_KEY);
      setDiet(d === 'vegetarian' || d === 'vegan' || d === 'other' ? d : 'none');
    } catch {
      // Sunucuya ulaşılamazsa kısıt uygulanmaz
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Değiştirmek için sağlık verisi izni gerekir
  const saveAllergens = useCallback(
    async (next: Allergen[]) => {
      await api.answerMyAnamnesis(ALLERGY_KEY, next.length ? next : ['none']);
      await reload();
    },
    [reload],
  );

  const saveDiet = useCallback(
    async (next: DietPreference) => {
      await api.answerMyAnamnesis(DIET_KEY, next);
      await reload();
    },
    [reload],
  );

  return { allergens, diet, saveAllergens, saveDiet };
}
