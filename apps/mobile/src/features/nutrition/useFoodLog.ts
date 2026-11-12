// Öğün ve su günlüğüm (sunucu): seçili günün haftası yüklenir. Kayıt eklenince/silinince yeniden yüklenir.
import type { FoodDay } from '@fitapp/api-client';
import { showToast } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { addDays, weekdayIndex } from '@/demo/dates';
import { useToday } from '@/demo/hooks';

const EMPTY = (date: string): FoodDay => ({ date, meals: [], totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, waterMl: 0 });

export function useFoodLog(date: string) {
  const today = useToday();
  const [days, setDays] = useState<FoodDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const monday = addDays(date, -weekdayIndex(date));
    // İleri günler sorgulanmaz (kayıt olamaz)
    const sunday = addDays(monday, 6);
    try {
      setDays(await api.myFood(monday, sunday > today ? today : sunday));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [date, today]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Hata olursa ekranda uyarı olarak gösterilir; başarılıysa günlük yeniden yüklenir
  const run = useCallback(
    async (fn: () => Promise<unknown>, message?: string) => {
      try {
        await fn();
        if (message) showToast(message);
        await reload();
        return true;
      } catch (e) {
        showToast(errorText(e), 'warning');
        return false;
      }
    },
    [reload],
  );

  return {
    day: days.find((d) => d.date === date) ?? EMPTY(date),
    marked: days.filter((d) => d.meals.length > 0).map((d) => d.date),
    error,
    reload,
    run,
  };
}
