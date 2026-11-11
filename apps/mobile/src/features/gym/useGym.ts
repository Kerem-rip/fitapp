// Spor salonu verileri: giriş yapan yönetici veya personelin salonu.
import { useMemo } from 'react';
import { useAccount, useShared, useToday } from '@/demo/hooks';
import { weekdayIndex } from '@/demo/dates';
import type { Gym, GymLesson, GymMember, GymStaff, GymTask } from '@/demo/types';

export interface GymData {
  gym: Gym | undefined;
  staff: GymStaff[];
  tasks: GymTask[];
  members: GymMember[];
  lessons: GymLesson[];
  // Giriş yapan personel (eğitmen) kaydı; yönetici için undefined
  me: GymStaff | undefined;
  today: string;
  // 0 = Pazartesi
  todayIndex: number;
  staffName: (id: string) => string;
}

export function useGym(): GymData {
  const account = useAccount();
  const shared = useShared();
  const today = useToday();

  return useMemo(() => {
    const gymId = account?.gymId;
    const staff = shared.gymStaff.filter((s) => s.gymId === gymId);
    return {
      gym: shared.gyms.find((g) => g.id === gymId),
      staff,
      tasks: shared.gymTasks.filter((t) => t.gymId === gymId),
      members: shared.gymMembers.filter((m) => m.gymId === gymId),
      lessons: shared.gymLessons.filter((l) => l.gymId === gymId),
      me: staff.find((s) => s.accountId === account?.id),
      today,
      todayIndex: weekdayIndex(today),
      staffName: (id: string) => staff.find((s) => s.id === id)?.name ?? 'Personel',
    };
  }, [account, shared, today]);
}

// "08:00–16:00" → başlangıç saati (sıralama için); izinli ise null
export function shiftStart(shift: string | undefined): string | null {
  if (!shift || shift === 'İzinli') return null;
  return shift.split('–')[0] ?? null;
}
