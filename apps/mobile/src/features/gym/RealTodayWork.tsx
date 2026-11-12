// Ana ekranın "bugün" iş bölümleri (gerçek veri): vardiyadakiler, bugünkü dersler ve bekleyen görevler.
// mine: ekipteki kişi için sadece kendi vardiyası, dersleri ve görevleri.
import type { GymLessonItem, GymTaskItem } from '@fitapp/api-client';
import { Card, IconButton, ListRow, Notice, SectionHeader, showToast, Tag } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { weekdayIndex } from '@/demo/dates';
import { useToday } from '@/demo/hooks';
import { GYM_ROLE_LABELS } from './labels';
import { lessonTag } from './RealLessons';
import { dueTag } from './RealTasks';
import { shiftLabel, useGymTeam } from './useGymTeam';

export function RealTodayWork({ mine, userId, links }: { mine: boolean; userId: string; links: { team?: string; tasks: string; lessons: string } }) {
  const router = useRouter();
  const today = useToday();
  const todayIndex = weekdayIndex(today);
  const { team } = useGymTeam();
  const [lessons, setLessons] = useState<GymLessonItem[]>([]);
  const [tasks, setTasks] = useState<GymTaskItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([api.gymLessons(today, today, mine), api.gymTasks({ status: 'open', mine })]);
      setLessons(l.filter((x) => x.status === 'SCHEDULED'));
      setTasks(t);
    } catch {
      // Sunucuya ulaşılamazsa bölümler boş kalır
    }
  }, [today, mine]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onShift = team
    .filter((t) => (mine ? t.user.id === userId : true) && t.days[todayIndex])
    .sort((a, b) => (a.days[todayIndex]?.start ?? '').localeCompare(b.days[todayIndex]?.start ?? ''));

  const complete = async (t: GymTaskItem) => {
    try {
      await api.setGymTaskDone(t.id, true);
      showToast('Görev tamamlandı');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      <SectionHeader title={mine ? 'Bugünkü vardiyam' : 'Bugünkü vardiyalar'} action={links.team ? 'Ekip' : undefined} onAction={links.team ? () => router.push(links.team as never) : undefined} />
      {onShift.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {onShift.map((s, i) => (
            <ListRow
              key={s.user.id}
              avatar={s.user.name}
              title={s.user.name}
              subtitle={GYM_ROLE_LABELS[s.role]}
              trailing={<Tag label={shiftLabel(s.days[todayIndex])} kind="accent" icon="time-outline" />}
              last={i === onShift.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Notice kind="info" text={mine ? 'Bugün vardiyan yok.' : 'Bugün vardiya yazılmamış.'} />
      )}

      <SectionHeader title={mine ? 'Bugünkü derslerim' : 'Bugünkü dersler'} action="Tümü" onAction={() => router.push(links.lessons as never)} />
      {lessons.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {lessons.map((l, i) => {
            const tag = lessonTag(l);
            return (
              <ListRow
                key={l.id}
                icon={l.kind === 'GROUP' ? 'people-outline' : 'barbell-outline'}
                title={`${l.startTime} · ${l.title}`}
                subtitle={l.trainer.name}
                trailing={<Tag label={tag.label} kind={tag.kind} />}
                onPress={() => router.push(`/gym-lesson/${l.id}`)}
                last={i === lessons.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <Notice kind="info" text={mine ? 'Bugün dersin yok.' : 'Bugün ders yok.'} />
      )}

      <SectionHeader title={mine ? 'Görevlerim' : 'Bekleyen görevler'} action="Tümü" onAction={() => router.push(links.tasks as never)} />
      {tasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {tasks.slice(0, 5).map((t, i, list) => {
            const due = dueTag(t, today);
            return (
              <ListRow
                key={t.id}
                icon="checkbox-outline"
                title={t.title}
                subtitle={mine ? undefined : t.assignee.name}
                trailing={
                  <>
                    {due ? <Tag label={due.label} kind={due.kind} /> : null}
                    {t.assignee.id === userId ? <IconButton icon="checkmark" label="Görevi tamamla" size={36} filled onPress={() => complete(t)} /> : null}
                  </>
                }
                last={i === list.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <Notice kind="success" text={mine ? 'Bekleyen görevin yok.' : 'Bekleyen görev yok.'} />
      )}
    </>
  );
}
