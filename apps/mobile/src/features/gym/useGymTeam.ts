// Salonun ekibi ve haftalık vardiyaları (gerçek veri). Ders verecek kişi, görev atanacak kişi ve vardiya listesi buradan gelir.
import type { GymShiftRow } from '@fitapp/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';

export function useGymTeam(enabled = true) {
  const [team, setTeam] = useState<GymShiftRow[]>([]);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      setTeam(await api.gymShifts());
    } catch {
      // Sunucuya ulaşılamazsa liste boş kalır
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { team, reload, nameOf: (id: string) => team.find((t) => t.user.id === id)?.user.name ?? 'Ekip üyesi' };
}

// "08:00–16:00" görünümü
export const shiftLabel = (s: { start: string; end: string } | null | undefined) => (s ? `${s.start}–${s.end}` : 'İzinli');
