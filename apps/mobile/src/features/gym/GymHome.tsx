// Genel (salon yöneticisi): günün özeti — vardiyalar, görevler, dersler.
import { Card, ListRow, Notice, Screen, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { formatLong } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';
import { RealGymToday } from './RealGymToday';
import { shiftStart, useGym } from './useGym';
import { useGymInfo } from './useGymInfo';

export function GymHome() {
  const router = useRouter();
  const account = useAccount();
  const { info } = useGymInfo();
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
      <AppHeader title={`Merhaba, ${account.firstName}`} subtitle={`${info?.gym.name ?? gym?.name ?? 'Salon'} · ${formatLong(today)}`} showMessages={false} />

      {info ? <RealGymToday /> : <DemoSummary onShift={onShift.length} lessons={todaysLessons.length} openTasks={openTasks.length} staff={staff.length} expiring={expiring.length} />}

      {info ? <Notice kind="info" text="Vardiya, görev ve ders bölümleri henüz örnek veriyle çalışıyor; sıradaki aşamada gerçek veriye bağlanacak." /> : null}

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

// Sunucuda salonu olmayan demo hesaplar için örnek özet
function DemoSummary({ onShift, lessons, openTasks, staff, expiring }: { onShift: number; lessons: number; openTasks: number; staff: number; expiring: number }) {
  return (
    <>
      <Card variant="accent">
        <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
          BUGÜN
        </Text>
        <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
          {onShift} personel vardiyada
        </Text>
        <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
          {lessons} ders · {openTasks} bekleyen görev
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Personel" value={String(staff)} sub="ekipte" icon="people-outline" />
        <StatTile label="Görev" value={String(openTasks)} sub="bekleyen" icon="checkbox-outline" />
        <StatTile label="Üyelik" value={String(expiring)} sub="bitiyor" icon="id-card-outline" />
      </View>
    </>
  );
}