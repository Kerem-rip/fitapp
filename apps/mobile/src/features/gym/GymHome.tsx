// Genel (salon yöneticisi): günün özeti — vardiyalar, görevler, dersler.
import { Card, ListRow, Notice, Screen, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { formatLong } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';
import { shiftStart, useGym } from './useGym';

export function GymHome() {
  const router = useRouter();
  const account = useAccount();
  const { gym, staff, tasks, members, lessons, today, todayIndex, staffName } = useGym();

  if (!account) return null;

  const onShift = staff
    .filter((s) => shiftStart(s.shifts[todayIndex]) !== null)
    .sort((a, b) => (shiftStart(a.shifts[todayIndex]) ?? '').localeCompare(shiftStart(b.shifts[todayIndex]) ?? ''));
  const openTasks = tasks.filter((t) => !t.done);
  const todaysLessons = lessons.filter((l) => l.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const expiring = members.filter((m) => m.membership === 'expiring');

  return (
    <Screen tabBarInset>
      <AppHeader title={`Merhaba, ${account.firstName}`} subtitle={`${gym?.name ?? 'Salon'} · ${formatLong(today)}`} showMessages={false} />

      <Card variant="accent">
        <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
          BUGÜN
        </Text>
        <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
          {onShift.length} personel vardiyada
        </Text>
        <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
          {todaysLessons.length} ders · {openTasks.length} bekleyen görev
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Personel" value={String(staff.length)} sub="ekipte" icon="people-outline" />
        <StatTile label="Görev" value={String(openTasks.length)} sub="bekleyen" icon="checkbox-outline" />
        <StatTile label="Üyelik" value={String(expiring.length)} sub="bitiyor" icon="id-card-outline" />
      </View>

      <SectionHeader title="Bugünkü vardiyalar" action="Ekip" onAction={() => router.push('/(gym-manager)/team')} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {onShift.map((s, i) => (
          <ListRow
            key={s.id}
            avatar={s.name}
            title={s.name}
            subtitle={s.role === 'trainer' ? 'Eğitmen' : 'Resepsiyon'}
            trailing={<Tag label={s.shifts[todayIndex] ?? ''} kind="accent" icon="time-outline" />}
            last={i === onShift.length - 1}
          />
        ))}
      </Card>

      <SectionHeader title="Bekleyen görevler" action="Tümü" onAction={() => router.push('/(gym-manager)/tasks')} />
      {openTasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {openTasks.slice(0, 4).map((t, i, list) => (
            <ListRow
              key={t.id}
              icon="checkbox-outline"
              title={t.title}
              subtitle={staffName(t.assigneeId)}
              trailing={<Tag label={t.due} kind={t.due === 'Bugün' ? 'warning' : 'neutral'} />}
              last={i === list.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Notice kind="success" text="Bekleyen görev yok." />
      )}

      <SectionHeader title="Bugünkü dersler" action="Üyeler" onAction={() => router.push('/(gym-manager)/members')} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {todaysLessons.map((l, i) => (
          <ListRow
            key={l.id}
            icon={l.kind === 'group' ? 'people-outline' : 'barbell-outline'}
            title={`${l.time} · ${l.title}${l.memberName ? ` · ${l.memberName}` : ''}`}
            subtitle={staffName(l.trainerId)}
            trailing={<Tag label={l.kind === 'group' ? 'Grup' : 'Özel'} kind={l.kind === 'group' ? 'info' : 'accent'} />}
            last={i === todaysLessons.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );
}
