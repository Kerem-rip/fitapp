// Kişinin sunucudaki temel sağlık bilgileri: son boy ve kilo ölçümü, alerji ve beslenme tercihi yanıtı.
// "Profilini doldur" kartı ve kalori hedefi buradan beslenir. Girilmemiş bilgi için değer uydurulmaz (null).
import type { IntakeQuestionView, MeasurementItem } from '@fitapp/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';

export interface HealthProfile {
  loaded: boolean;
  height: MeasurementItem | null;
  weight: MeasurementItem | null;
  // Yanıtın okunur hali; yanıtlanmadıysa null
  allergies: string | null;
  diet: string | null;
  filled: number;
  total: number;
}

const latest = (list: MeasurementItem[]) => list.filter((m) => !m.voided).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0] ?? null;

function answerText(q: IntakeQuestionView | undefined): string | null {
  const value = q?.answer?.value;
  if (value === undefined || value === null || value === '') return null;
  const label = (v: unknown) => q?.options?.find((o) => o.value === v)?.label ?? String(v);
  if (Array.isArray(value)) return value.length ? value.map(label).join(', ') : null;
  return label(value);
}

export function useHealthProfile(): HealthProfile {
  const [state, setState] = useState<HealthProfile>({ loaded: false, height: null, weight: null, allergies: null, diet: null, filled: 0, total: 4 });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        api.myMeasurements({ kind: 'HEIGHT' }).catch(() => []),
        api.myMeasurements({ kind: 'WEIGHT' }).catch(() => []),
        api.myAnamnesis().catch(() => null),
      ]).then(([heights, weights, anamnesis]) => {
        if (cancelled) return;
        const q = (key: string) => anamnesis?.questions.find((x) => x.key === key);
        const next = {
          height: latest(heights),
          weight: latest(weights),
          allergies: answerText(q('std.allergies')),
          diet: answerText(q('std.diet_preference')),
        };
        const filled = [next.height, next.weight, next.allergies, next.diet].filter((v) => v !== null).length;
        setState({ loaded: true, ...next, filled, total: 4 });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return state;
}
