// Görevler. Yönetici personele görev atar ve takip eder; personel kendi görevlerini tamamlar.
import { BottomSheet, Button, Card, EmptyState, IconButton, ListRow, Screen, ScreenHeader, showToast, Tag, TextField, Text } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { ChipRow } from '@/components/ChipRow';
import { addTask, toggleTask } from '@/demo/actions';
import { useAccount } from '@/demo/hooks';
import { useGym } from './useGym';

type Filter = 'open' | 'done' | 'all';
const DUES = ['Bugün', 'Yarın', 'Bu hafta'];

export function GymTasksScreen({ mine = false }: { mine?: boolean }) {
  const account = useAccount();
  const { gym, staff, tasks, me, staffName } = useGym();
  const [filter, setFilter] = useState<Filter>('open');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('Bugün');

  if (!account) return null;

  const visible = tasks
    .filter((t) => (mine ? t.assigneeId === me?.id : true))
    .filter((t) => (filter === 'open' ? !t.done : filter === 'done' ? t.done : true))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));

  const create = () => {
    if (!title.trim()) {
      showToast('Görev başlığı yaz', 'warning');
      return;
    }
    const target = assignee || staff[0]?.id;
    if (!gym || !target) return;
    addTask({ gymId: gym.id, title, assigneeId: target, due });
    setOpen(false);
    setTitle('');
    showToast(`Görev ${staffName(target)} kişisine atandı`);
  };

  return (
    <Screen tabBarInset>
      <ScreenHeader title={mine ? 'Görevlerim' : 'Görevler'} subtitle={mine ? 'Yöneticinin atadıkları' : 'Personele ata ve takip et'} />
      <ChipRow
        options={[
          { key: 'open' as const, label: 'Bekleyen' },
          { key: 'done' as const, label: 'Biten' },
          { key: 'all' as const, label: 'Tümü' },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />

      {visible.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {visible.map((t, i) => (
            <ListRow
              key={t.id}
              icon={t.done ? 'checkmark-circle' : 'ellipse-outline'}
              title={t.title}
              subtitle={mine ? undefined : staffName(t.assigneeId)}
              trailing={
                <>
                  {t.done ? <Tag label="Bitti" kind="success" /> : <Tag label={t.due} kind={t.due === 'Bugün' ? 'warning' : 'neutral'} />}
                  <IconButton
                    icon={t.done ? 'arrow-undo' : 'checkmark'}
                    label={t.done ? 'Görevi geri aç' : 'Görevi tamamla'}
                    size={36}
                    filled={!t.done}
                    onPress={() => toggleTask(t.id)}
                  />
                </>
              }
              last={i === visible.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="checkbox-outline" title="Görev yok" text={mine ? 'Sana atanmış görev kalmadı.' : 'Yeni bir görev atayabilirsin.'} />
      )}

      {!mine ? <Button label="Görev ata" icon="add" size="lg" block onPress={() => { setAssignee(staff[0]?.id ?? ''); setOpen(true); }} style={{ marginTop: 8 }} /> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Görev ata">
        <TextField label="Görev" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Kime
        </Text>
        <ChipRow wrap options={staff.map((s) => ({ key: s.id, label: s.name }))} selected={[assignee]} onToggle={setAssignee} />
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Ne zamana kadar
        </Text>
        <ChipRow wrap options={DUES.map((d) => ({ key: d, label: d }))} selected={[due]} onToggle={setDue} />
        <Button label="Ata" size="lg" block onPress={create} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </Screen>
  );
}
