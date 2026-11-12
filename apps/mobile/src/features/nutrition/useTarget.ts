// Kullanıcının günlük kalori hedefi: kendi belirlediği hedef ya da hesaplanan tahmini hedef.
// Boy ve kilo sunucudaki son ölçümlerden gelir. İkisi de yoksa ve kişi kendi hedefini belirlemediyse
// hedef uydurulmaz: `missing` true olur ve ekran "boy ve kilonu ekle" der.
import { ageOn, estimateCalories, validateCalorieInput, type CalorieResult } from '@fitapp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAccount, useUserData } from '@/demo/hooks';

export interface TargetInfo {
  result: CalorieResult | null;
  // missing ise 0
  target: number;
  ageYears: number;
  isCustom: boolean;
  // Hedef hesaplanamıyor (boy/kilo yok ve kendi hedefi yok)
  missing: boolean;
  // Sunucudaki son ölçümler (yoksa null)
  heightCm: number | null;
  weightKg: number | null;
}

const latestValue = (list: { value: number; takenAt: string; voided: boolean }[]) =>
  list.filter((m) => !m.voided).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]?.value ?? null;

export function useTarget(): TargetInfo {
  const account = useAccount();
  const data = useUserData();
  const [measured, setMeasured] = useState<{ heightCm: number | null; weightKg: number | null }>({ heightCm: null, weightKg: null });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([api.myMeasurements({ kind: 'HEIGHT' }).catch(() => []), api.myMeasurements({ kind: 'WEIGHT' }).catch(() => [])]).then(([h, w]) => {
        if (!cancelled) setMeasured({ heightCm: latestValue(h), weightKg: latestValue(w) });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return useMemo(() => {
    const ageYears = account ? ageOn(new Date(account.birthDate)) : 25;
    const { heightCm, weightKg } = measured;
    const input =
      heightCm !== null && weightKg !== null
        ? ({ sex: account?.sex ?? 'other', ageYears, heightCm, weightKg, activity: data.activity, goal: data.goal } as const)
        : null;
    const result = input && validateCalorieInput(input) === null ? estimateCalories(input) : null;
    const isCustom = data.targetKcal !== null;
    const target = data.targetKcal ?? result?.target ?? 0;
    return { result, ageYears, isCustom, target, missing: target === 0, heightCm, weightKg };
  }, [account, measured, data.activity, data.goal, data.targetKcal]);
}
