// Salon eğitmeni (personel) ekranları: bugün, danışanlar, dersler, profil.
import { Card, EmptyState, IconButton, ListRow, Notice, Screen, ScreenHeader, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AccountSection } from '@/components/AccountSection';
import { AppHeader } from '@/components/AppHeader';
import { WeekStrip } from '@/components/WeekStrip';
import { toggleTask } from '@/demo/actions';
import { formatLong, DAY_SHORT } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';
import { ROLE_LABELS, WEEKDAY_FULL } from '@/demo/labels';
import { fullName } from '@/demo/selectors';
import { GYM_ROLE_LABELS } from './labels';
import { RealGymToday } from './RealGymToday';
import { RealLessons } from './RealLessons';
import { RealMembers } from './RealMembers';
import { RealTodayWork } from './RealTodayWork';
import { useGym } from './useGym';
import { useGymInfo } from './useGymInfo';
import { shiftLabel, useGymTeam } from './useGymTeam';

export function StaffHome() {
  const account = useAccount();
  const { info } = useGymInfo();
  const { gym, tasks, lessons, me, today, todayIndex } = useGym();

  if (!account) return null;
  if (info) {
    // Eğitmen kendi derslerini, resepsiyon salonun tüm derslerini görür
    return (
      <Screen tabBarInset>
        <AppHeader title={`Merhaba, ${account.firstName}`} subtitle={`${info.gym.name} · ${formatLong(today)}`} showMessages={false} />
        <RealGymToday />
        <RealTodayWork mine={info.role === 'TRAINER'} userId={info.userId} links={{ tasks: '/(gym-staff)/tasks', lessons: '/(gym-staff)/lessons' }} />
      </Screen>
    );
  }
  const shift = me?.shifts[todayIndex] ?? 'İzinli';
  const myTasks = tasks.filter((t) => t.assigneeId === me?.id && !t.done);
  const myLessons = lessons.filter((l) => l.trainerId === me?.id && l.date === today).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Screen tabBarInset>
      <AppHeader title={`Merhaba, ${account.firstName}`} subtitle={`${gym?.name ?? 'Salon'} · ${formatLong(today)}`} showMessages={false} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Vardiya" value={shift === 'İzinli' ? 'İzinli' : shift.replace('–', '-')} icon="time-outline" />
        <StatTile label="Görev" value={String(myTasks.length)} sub="bekleyen" icon="checkbox-outline" />
        <StatTile label="Ders" value={String(myLessons.length)} sub="bugün" icon="calendar-outline" />
      </View>

      <SectionHeader title="Bugünkü derslerim" />
      {myLessons.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {myLessons.map((l, i) => (
            <ListRow
              key={l.id}
              icon={l.kind === 'group' ? 'people-outline' : 'barbell-outline'}
              title={`${l.time} · ${l.title}${l.memberName ? ` · ${l.memberName}` : ''}`}
              trailing={<Tag label={l.kind === 'group' ? 'Grup' : 'Özel'} kind={l.kind === 'group' ? 'info' : 'accent'} />}
              last={i === myLessons.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Notice kind="info" text="Bugün dersin yok." />
      )}

      <SectionHeader title="Görevlerim" />
      {myTasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {myTasks.map((t, i) => (
            <ListRow
              key={t.id}
              icon="ellipse-outline"
              title={t.title}
              subtitle="Yöneticiden"
              trailing={
                <>
                  <Tag label={t.due} kind={t.due === 'Bugün' ? 'warning' : 'neutral'} />
                  <IconButton icon="checkmark" label="Görevi tamamla" size={36} filled onPress={() => toggleTask(t.id)} />
                </>
              }
              last={i === myTasks.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Notice kind="success" text="Bekleyen görevin yok." />
      )}
    </Screen>
  );
}

export function StaffClients() {
  const { info, can } = useGymInfo();
  const { members, me, staffName } = useGym();
  const mine = members.filter((m) => m.trainerId === me?.id);

  if (info) {
    return (
      <Screen tabBarInset>
        <ScreenHeader title="Salon üyeleri" subtitle={`${info.gym.name} · ${GYM_ROLE_LABELS[info.role]}`} />
        <RealMembers canManage={can('members.manage')} />
      </Screen>
    );
  }

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Danışanlarım" subtitle={`${mine.length} üye`} />
      {mine.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {mine.map((m, i) => (
            <ListRow
              key={m.id}
              avatar={m.name}
              title={m.name}
              subtitle={`Özel ders ${m.privateLessonsLeft} kaldı · ${staffName(m.trainerId ?? '')}`}
              trailing={m.membership === 'expiring' ? <Tag label={`${m.daysLeft} gün kaldı`} kind="warning" /> : <Tag label="Aktif" kind="success" />}
              last={i === mine.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="people-outline" title="Danışanın yok" />
      )}
      <Notice kind="success" text="Danışanın sağlık verisini yalnızca danışan paylaşırsa görürsün." />
    </Screen>
  );
}

export function StaffLessons() {
  const { info } = useGymInfo();
  if (info) {
    return (
      <Screen tabBarInset>
        <ScreenHeader title={info.role === 'TRAINER' ? 'Derslerim' : 'Dersler'} subtitle={info.gym.name} />
        <RealLessons mine={info.role === 'TRAINER'} />
      </Screen>
    );
  }
  return <DemoStaffLessons />;
}

function DemoStaffLessons() {
  const { lessons, me, today, staffName } = useGym();
  const [date, setDate] = useState(today);
  const mine = useMemo(() => lessons.filter((l) => l.trainerId === me?.id), [lessons, me?.id]);
  const day = mine.filter((l) => l.date === date).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Dersler" subtitle={formatLong(date)} />
      <WeekStrip selected={date} onSelect={setDate} marked={mine.map((l) => l.date)} />
      {day.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {day.map((l, i) => (
            <ListRow
              key={l.id}
              icon={l.kind === 'group' ? 'people-outline' : 'barbell-outline'}
              title={`${l.time} · ${l.title}`}
              subtitle={l.memberName ?? `Eğitmen: ${staffName(l.trainerId)}`}
              trailing={<Tag label={l.kind === 'group' ? 'Grup' : 'Özel'} kind={l.kind === 'group' ? 'info' : 'accent'} />}
              last={i === day.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="calendar-clear-outline" title="Bu gün dersin yok" />
      )}
    </Screen>
  );
}

export function StaffProfile() {
  const router = useRouter();
  const account = useAccount();
  const { info } = useGymInfo();
  const { team } = useGymTeam();
  const { gym, me, todayIndex } = useGym();
  if (!account) return null;
  const myShifts = info ? team.find((t) => t.user.id === info.userId)?.days : undefined;

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Profil" subtitle={info ? `${info.gym.name} ${GYM_ROLE_LABELS[info.role].toLocaleLowerCase('tr-TR')}` : ROLE_LABELS[account.roleKey]} />
      <Card>
        <Text variant="title">{fullName(account)}</Text>
        <Text variant="caption" tone="secondary">
          @{account.username} · {info?.gym.name ?? gym?.name}
        </Text>
        <Text variant="body" style={{ marginTop: 10 }}>
          {account.bio}
        </Text>
      </Card>

      <SectionHeader title="Haftalık vardiyam" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {WEEKDAY_FULL.map((dayName, i) => (
          <ListRow
            key={dayName}
            icon="time-outline"
            title={dayName}
            trailing={
              info ? (
                <Tag label={shiftLabel(myShifts?.[i])} kind={i === todayIndex ? 'accent' : myShifts?.[i] ? 'info' : 'neutral'} />
              ) : (
                <Tag label={me?.shifts[i] ?? 'İzinli'} kind={i === todayIndex ? 'accent' : me?.shifts[i] === 'İzinli' ? 'neutral' : 'info'} />
              )
            }
            last={i === WEEKDAY_FULL.length - 1}
          />
        ))}
      </Card>
      <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
        Vardiyalarını salon yöneticisi belirler. Bugün: {DAY_SHORT[todayIndex]}.
      </Text>

      <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <ListRow icon="mail-open-outline" title="Salon davetlerim" subtitle="Davetler ve salondan ayrılma" onPress={() => router.push('/gym-invites')} last />
      </Card>

      <AccountSection />
    </Screen>
  );
}
