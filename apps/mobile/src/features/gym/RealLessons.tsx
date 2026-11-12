// Salon ders takvimi (gerçek veri): hafta şeridi, günün dersleri ve ders ekleme.
// mine: sadece giriş yapan eğitmenin dersleri.
import type { GymLessonItem } from '@fitapp/api-client';
import { Button, Card, EmptyState, IconButton, ListRow, Notice, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { WeekStrip } from '@/components/WeekStrip';
import { addDays, formatLong } from '@/demo/dates';
import { useToday } from '@/demo/hooks';
import { LessonCreateSheet } from './LessonCreateSheet';
import { useGymInfo } from './useGymInfo';
import { useGymTeam } from './useGymTeam';

export function lessonTag(l: GymLessonItem): { label: string; kind: 'info' | 'accent' | 'neutral' } {
  if (l.status === 'CANCELLED') return { label: 'İptal', kind: 'neutral' };
  return l.kind === 'GROUP' ? { label: `Grup · ${l.booked ?? 0}/${l.capacity}`, kind: 'info' } : { label: 'Özel', kind: 'accent' };
}

export function RealLessons({ mine = false }: { mine?: boolean }) {
  const router = useRouter();
  const today = useToday();
  const { info, can } = useGymInfo();
  const { team } = useGymTeam();
  const [date, setDate] = useState(today);
  const [lessons, setLessons] = useState<GymLessonItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Seçili günün haftası ve sonraki iki hafta
  const load = useCallback(async () => {
    const monday = addDays(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
    try {
      setLessons(await api.gymLessons(monday, addDays(monday, 20), mine));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [date, mine]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const day = lessons.filter((l) => l.date === date);
  const manager = can('lessons.manage');
  // Eğitmen kendi özel dersini ekleyebilir; resepsiyon/sahip her dersi
  const canAdd = info !== null && (manager || info.role === 'TRAINER');

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <IconButton icon="chevron-back" label="Önceki hafta" size={34} onPress={() => setDate(addDays(date, -7))} />
        <Text variant="bodyStrong">{formatLong(date)}</Text>
        <IconButton icon="chevron-forward" label="Sonraki hafta" size={34} onPress={() => setDate(addDays(date, 7))} />
      </View>
      <WeekStrip selected={date} onSelect={setDate} marked={lessons.filter((l) => l.status === 'SCHEDULED').map((l) => l.date)} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {day.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {day.map((l, i) => {
            const tag = lessonTag(l);
            return (
              <ListRow
                key={l.id}
                icon={l.kind === 'GROUP' ? 'people-outline' : 'barbell-outline'}
                title={`${l.startTime} · ${l.title}`}
                subtitle={`${l.trainer.name} · ${l.durationMin} dk${l.status === 'CANCELLED' && l.cancelReason ? ` · ${l.cancelReason}` : ''}`}
                trailing={<Tag label={tag.label} kind={tag.kind} />}
                onPress={() => router.push(`/gym-lesson/${l.id}`)}
                last={i === day.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <EmptyState icon="calendar-clear-outline" title={mine ? 'Bu gün dersin yok' : 'Bu gün ders yok'} />
      )}
      {canAdd ? <Button label="Ders ekle" icon="add" size="lg" block onPress={() => setAdding(true)} style={{ marginTop: 8 }} /> : null}

      {adding && info ? (
        <LessonCreateSheet
          date={date}
          manager={manager}
          selfId={info.userId}
          team={team}
          onClose={() => setAdding(false)}
          onCreated={(warning, count) => {
            setAdding(false);
            showToast(count > 1 ? `${count} haftalık ders eklendi` : 'Ders eklendi');
            if (warning) showToast(warning.text, 'warning');
            void load();
          }}
        />
      ) : null}
    </>
  );
}
