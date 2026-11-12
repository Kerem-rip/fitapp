// Salon (yönetici): müşterilerin gördüğü vitrin, çalışma saatleri, dersler ve hesap işlemleri.
import { Avatar, Button, Card, ListRow, Screen, ScreenHeader, SectionHeader, Stars, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AccountSection } from '@/components/AccountSection';
import { formatLong } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';
import { fullName, proByAccount } from '@/demo/selectors';
import { RealGymInfo } from './RealGymInfo';
import { RealPlans } from './RealPlans';
import { useGym } from './useGym';
import { useGymInfo } from './useGymInfo';

export function GymProfileScreen() {
  const router = useRouter();
  const account = useAccount();
  const { info, can, reload } = useGymInfo();
  const { gym, staff, lessons, today } = useGym();
  const pro = account ? proByAccount(account.id) : undefined;

  if (!account) return null;
  // Gerçek salonu olan hesap: salon bilgileri, paketler ve hesap işlemleri (örnek vitrin sadece demo salonda görünür)
  if (info && !gym) {
    return (
      <Screen tabBarInset>
        <ScreenHeader title="Salon" subtitle={info.gym.name} />
        <RealGymInfo info={info} canEdit={can('gym.edit')} canReport={can('reports.view')} onSaved={reload} />
        {info ? <RealGymInfo info={info} canEdit={can('gym.edit')} canReport={can('reports.view')} onSaved={reload} /> : null}
      {can('plans.manage') ? <RealPlans /> : null}
        <AccountSection />
      </Screen>
    );
  }
  if (!gym) return null;
  const groupLessons = lessons.filter((l) => l.kind === 'group' && l.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);
  const trainers = staff.filter((s) => s.role === 'trainer');

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Salon" subtitle="Müşterilerin gördüğü vitrin" />

      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={info?.gym.name ?? gym.name} size={72} story />
          <View style={{ flex: 1, marginLeft: 8, gap: 6 }}>
            <Text variant="title">{info?.gym.name ?? gym.name}</Text>
            <Text variant="caption" tone="secondary">
              Spor salonu · {gym.district}
            </Text>
            <Tag label="Doğrulanmış" kind="success" icon="checkmark-circle" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Stars value={pro?.rating ?? 4.7} size={16} />
          <Text variant="caption" tone="secondary">
            {(pro?.rating ?? 4.7).toLocaleString('tr-TR')} · {pro?.clientCount ?? 0} üye
          </Text>
        </View>
        <Text variant="body" style={{ marginTop: 10 }}>
          {pro?.bio}
        </Text>
        <Button label="Müşteriler nasıl görür" variant="ghost" block onPress={() => router.push('/professional/pro-fitmerkez')} style={{ marginTop: 14 }} />
      </Card>

      {info ? <RealGymInfo info={info} canEdit={can('gym.edit')} canReport={can('reports.view')} onSaved={reload} /> : null}
      {can('plans.manage') ? <RealPlans /> : null}

      <SectionHeader title="Çalışma saatleri" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="time-outline" title="Hafta içi" trailing={<Text variant="bodyStrong">{gym.hoursWeekday}</Text>} />
        <ListRow icon="time-outline" title="Hafta sonu" trailing={<Text variant="bodyStrong">{gym.hoursWeekend}</Text>} last />
      </Card>

      <SectionHeader title="Yaklaşan grup dersleri" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {groupLessons.map((l, i) => (
          <ListRow
            key={l.id}
            icon="people-outline"
            title={`${l.title} · ${l.time}`}
            subtitle={formatLong(l.date)}
            last={i === groupLessons.length - 1}
          />
        ))}
      </Card>

      <SectionHeader title="Eğitmenler" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {trainers.map((t, i) => (
          <ListRow key={t.id} avatar={t.name} title={t.name} subtitle={t.invited ? 'Davet gönderildi' : 'Eğitmen'} last={i === trainers.length - 1} />
        ))}
      </Card>

      <Text variant="caption" tone="muted" style={{ marginTop: 12 }}>
        Giriş yapan: {fullName(account)}
      </Text>
      <AccountSection />
    </Screen>
  );
}
