// Kullanıcının günlük kalori hedefi: kendi belirlediği hedef ya da hesaplanan tahmini hedef.
import { ageOn, estimateCalories, validateCalorieInput, type CalorieResult } from '@fitapp/shared';
import { useMemo } from 'react';
import { useAccount, useUserData } from '@/demo/hooks';

export interface TargetInfo {
  result: CalorieResult | null;
  target: number;
  ageYears: number;
  isCustom: boolean;
}

export function useTarget(): TargetInfo {
  const account = useAccount();
  const data = useUserData();

  return useMemo(() => {
    const ageYears = account ? ageOn(new Date(account.birthDate)) : 25;
    const input = {
      sex: account?.sex ?? 'other',
      ageYears,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      activity: data.activity,
      goal: data.goal,
    } as const;
    const result = validateCalorieInput(input) === null ? estimateCalories(input) : null;
    const isCustom = data.targetKcal !== null;
    return { result, ageYears, isCustom, target: data.targetKcal ?? result?.target ?? 1800 };
  }, [account, data.heightCm, data.weightKg, data.activity, data.goal, data.targetKcal]);
}
