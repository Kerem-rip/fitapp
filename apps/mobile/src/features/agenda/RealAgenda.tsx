// Ajandanın gerçek hesaplar bölümü: önümüzdeki 7 günün randevuları ve vadesi gelen/geçen görevler (sunucudan).
import type { AgendaResponse } from '@fitapp/api-client';
import { Card, ListRow, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { dueLabel } from '@/features/review/labels';
import { formatTime, MODE_LABELS, startOfDay } from './helpers';

const dayTitle = (iso: string) => {
  const d = new Date(iso);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfDay().getTime()) / 86_400_000);
  return diff === 0 ? 'Bugün' : diff === 1 ? 'Yarın' : d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export function RealAgenda({
  days = 7,
  title = 'Randevularım (7 gün)',
  demoNote = false,
  showTasks = true,
}: {
  days?: number;
  title?: string;
  demoNote?: boolean;
  // Panelde görevler zaten "Bugün ne yapmalıyım?" içinde görünür
  showTasks?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<AgendaResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .agenda(startOfDay().toISOString(), startOfDay(days).toISOString())
        .then(setData)
        .catch(() => setData(null));
    }, [days]),
  );

  const scheduled = (data?.appointments ?? []).filter((a) => a.status === 'SCHEDULED');
  const tasks = showTasks ? (data?.tasks ?? []) : [];
  if (!data || (scheduled.length === 0 && tasks.length === 0)) return null;

  return (
    <>
      {scheduled.length > 0 ? (
        <>
          <SectionHeader title={title} />
          <Card padded={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            {scheduled.map((a, i) => (
              <ListRow
                key={a.id}
                icon={a.mode === 'ONLINE' ? 'videocam-outline' : 'people-outline'}
                title={`${dayTitle(a.startsAt)} ${formatTime(a.startsAt)} · ${a.client.name}`}
                subtitle={`${a.title ?? 'Randevu'} · ${MODE_LABELS[a.mode]} · ${a.durationMin} dk`}
                onPress={() => router.push(`/client-file/${a.client.id}`)}
                last={i === scheduled.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
      {tasks.length > 0 ? (
        <>
          <SectionHeader title="Vadesi gelen görevler" />
          <Card padded={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            {tasks.map((t, i) => {
              const d = dueLabel(t.dueAt);
              return (
                <ListRow
                  key={t.id}
                  icon="alarm-outline"
                  title={t.title}
                  subtitle={t.client.name}
                  trailing={<Tag label={d.text} kind={d.overdue ? 'danger' : d.today ? 'warning' : 'neutral'} />}
                  onPress={() => router.push(`/client-file/${t.client.id}`)}
                  last={i === tasks.length - 1}
                />
              );
            })}
          </Card>
        </>
      ) : null}
      {demoNote ? (
        <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>
          Aşağıdaki takvim demo verisidir.
        </Text>
      ) : null}
    </>
  );
}
