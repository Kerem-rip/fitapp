// Ekip görevleri (gerçek veri). Sahip atar, görevli kişi tamamlar ya da geri açar.
import type { GymTaskItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, IconButton, ListRow, Notice, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { addDays } from '@/demo/dates';
import { useToday } from '@/demo/hooks';
import { formatDate } from './labels';
import { useGymTeam } from './useGymTeam';

type Filter = 'open' | 'done' | 'all';

export function dueTag(task: GymTaskItem, today: string): { label: string; kind: 'warning' | 'danger' | 'neutral' } | null {
  if (!task.dueDate) return null;
  if (task.dueDate < today) return { label: 'Gecikti', kind: 'danger' };
  if (task.dueDate === today) return { label: 'Bugün', kind: 'warning' };
  if (task.dueDate === addDays(today, 1)) return { label: 'Yarın', kind: 'neutral' };
  return { label: formatDate(task.dueDate), kind: 'neutral' };
}

export function RealTasks({ manage, mine }: { manage: boolean; mine: boolean }) {
  const today = useToday();
  const { team } = useGymTeam(manage);
  const [filter, setFilter] = useState<Filter>('open');
  const [tasks, setTasks] = useState<GymTaskItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks(await api.gymTasks({ status: filter, mine }));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [filter, mine]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      showToast(message);
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      <ChipRow
        options={[
          { key: 'open' as const, label: 'Bekleyen' },
          { key: 'done' as const, label: 'Biten' },
          { key: 'all' as const, label: 'Tümü' },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />
      {error ? <Notice kind="danger" text={error} /> : null}
      {tasks && tasks.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="Görev yok" text={manage ? 'Ekibine yeni bir görev atayabilirsin.' : 'Sana atanmış görev yok.'} />
      ) : null}
      {tasks && tasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {tasks.map((t, i) => {
            const due = dueTag(t, today);
            return (
              <ListRow
                key={t.id}
                icon={t.done ? 'checkmark-circle' : 'ellipse-outline'}
                title={t.title}
                subtitle={mine ? undefined : t.assignee.name}
                trailing={
                  <>
                    {t.done ? <Tag label="Bitti" kind="success" /> : due ? <Tag label={due.label} kind={due.kind} /> : null}
                    <IconButton
                      icon={t.done ? 'arrow-undo' : 'checkmark'}
                      label={t.done ? 'Görevi geri aç' : 'Görevi tamamla'}
                      size={36}
                      filled={!t.done}
                      onPress={() => act(() => api.setGymTaskDone(t.id, !t.done), t.done ? 'Görev geri açıldı' : 'Görev tamamlandı')}
                    />
                    {manage ? <IconButton icon="trash-outline" label="Görevi sil" size={34} onPress={() => act(() => api.removeGymTask(t.id), 'Görev silindi')} /> : null}
                  </>
                }
                last={i === tasks.length - 1}
              />
            );
          })}
        </Card>
      ) : null}
      {manage ? <Button label="Görev ata" icon="add" size="lg" block onPress={() => setAdding(true)} style={{ marginTop: 8 }} /> : null}

      {adding ? (
        <TaskSheet
          team={team.map((t) => ({ id: t.user.id, name: t.user.name }))}
          today={today}
          onClose={() => setAdding(false)}
          onCreated={(name) => {
            setAdding(false);
            showToast(`Görev ${name} kişisine atandı`);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

const DUES = [
  { key: 'today', label: 'Bugün', offset: 0 },
  { key: 'tomorrow', label: 'Yarın', offset: 1 },
  { key: 'week', label: 'Bu hafta', offset: 6 },
  { key: 'none', label: 'Tarihsiz', offset: null },
] as const;

function TaskSheet({ team, today, onClose, onCreated }: { team: { id: string; name: string }[]; today: string; onClose: () => void; onCreated: (name: string) => void }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(team.find((t, i) => i > 0)?.id ?? team[0]?.id ?? '');
  const [due, setDue] = useState<(typeof DUES)[number]['key']>('today');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (title.trim().length < 2) return setError('Görevi yaz.');
    if (!assignee) return setError('Kime atanacağını seç.');
    const offset = DUES.find((d) => d.key === due)?.offset ?? null;
    setBusy(true);
    setError(null);
    try {
      await api.createGymTask({ title: title.trim(), assigneeId: assignee, dueDate: offset === null ? undefined : addDays(today, offset) });
      onCreated(team.find((t) => t.id === assignee)?.name ?? 'ekip');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Görev ata">
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Görev" value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={120} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Kime
      </Text>
      <ChipRow wrap options={team.map((t) => ({ key: t.id, label: t.name }))} selected={[assignee]} onToggle={setAssignee} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Ne zamana kadar
      </Text>
      <ChipRow wrap options={DUES.map((d) => ({ key: d.key, label: d.label }))} selected={[due]} onToggle={setDue} />
      <Button label={busy ? 'Kaydediliyor...' : 'Ata'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
