// Kişinin alerjileri: sağlık öyküsündeki "Hangi yiyeceklere alerjin var?" yanıtı (sunucu).
// Yemek ekleme uyarısı, öğün listesi ve örnek menü bu tek kaynağı kullanır. Değiştirmek de bu yanıtı günceller.
import { ALLERGENS, type Allergen } from '@fitapp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';

const KEY = 'std.allergies';

export function useMyAllergens() {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  // Soru yanıtlanmış mı (hiç yanıtlanmadıysa "alerjim yok" da denmemiştir)
  const [answered, setAnswered] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await api.myAnamnesis();
      const value = res.questions.find((q) => q.key === KEY)?.answer?.value;
      const list = Array.isArray(value) ? value.filter((v): v is Allergen => (ALLERGENS as string[]).includes(String(v))) : [];
      setAllergens(list);
      setAnswered(Array.isArray(value) && value.length > 0);
    } catch {
      // Sunucuya ulaşılamazsa uyarı listesi boş kalır
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Seçim değişince sağlık öyküsündeki yanıt güncellenir (sağlık verisi izni gerekir)
  const save = useCallback(
    async (next: Allergen[]) => {
      await api.answerMyAnamnesis(KEY, next.length ? next : ['none']);
      await reload();
    },
    [reload],
  );

  return { allergens, answered, save };
}
