// Panel (diyetisyen ve bağımsız eğitmen): günün randevuları, hatırlatıcılar, dikkat gerektiren danışanlar.
import { Button, Card, ListRow, Notice, Screen, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { formatLong } from '@/demo/dates';
import { useAccount, useDemoState, useToday } from '@/demo/hooks';
import { unreadTotal } from '@/demo/selectors';
import { useClients } from './useClients';

export function ProPanel() {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const today = useToday();
  const clients = useClients();

  const isDietitian = account?.roleKey === 'dietitian';

  const todays = useMemo(
    () =>
      state.shared.appointments
        .filter((a) => a.ownerId === account?.id && a.date === today)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [state.shared.appointments, account?.id, today],
  );

  const reminders = useMemo(() => {
    const list: { key: string; title: string; subtitle: string; tag: [string, 'warning' | 'accent']; clientId: string }[] = [];
    for (const item of clients) {
      if (item.needsAttention) {
        list.push({
          key: `att-${item.link.id}`,
          title: isDietitian
            ? `${item.view.name} ${item.view.lastEntryDaysAgo} gündür kayıt girmedi`
            : `${item.view.name} bu hafta antrenmanı atladı`,
          subtitle: isDietitian ? 'Hatırlatma mesajı gönderebilirsin' : 'Nasıl olduğunu sor',
          tag: ['Dikkat', 'warning'],
          clientId: item.view.id,
        });
      }
      if (isDietitian && item.allergyMissing) {
        list.push({
          key: `alg-${item.link.id}`,
          title: `${item.view.name} alerji bilgisi eksik`,
          subtitle: 'Plan hazırlamadan önce alerjileri öğren',
          tag: ['Eksik', 'warning'],
          clientId: item.view.id,
        });
      }
      if (item.isNew) {
        list.push({
          key: `new-${item.link.id}`,
          title: `${item.view.name} yeni danışanın`,
          subtitle: isDietitian ? 'Plan bekliyor' : 'Program bekliyor',
          tag: ['Yeni', 'accent'],
          clientId: item.view.id,
        });
      }
    }
    return list;
  }, [clients, isDietitian]);

  if (!account) return null;
  const unread = unreadTotal(state, account.id);
  const next = todays[0];

  return (
    <Screen tabBarInset>
      <AppHeader title={`Günaydın, ${account.firstName}`} subtitle={`${formatLong(today)} · ${todays.length} randevun var`} showMessages={!isDietitian} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Danışan" value={String(clients.length)} sub="aktif" icon="people-outline" />
        <StatTile label="Bugün" value={String(todays.length)} sub={isDietitian ? 'randevu' : 'ders'} icon="calendar-outline" />
        <StatTile label="Mesaj" value={String(unread)} sub="okunmamış" icon="chatbubble-ellipses-outline" />
      </View>

      <Card variant="accent">
        <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
          SIRADAKİ
        </Text>
        {next ? (
          <>
            <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
              {next.time} · {next.clientName}
            </Text>
            <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
              {next.title} · {next.kind === 'online' ? 'Online' : 'Yüz yüze'}
            </Text>
          </>
        ) : (
          <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
            Bugün için randevu yok
          </Text>
        )}
        <Button label="Ajandayı aç" variant="light" size="sm" icon="calendar-outline" onPress={() => router.push(isDietitian ? '/(dietitian)/agenda' : '/(trainer)/agenda')} style={{ marginTop: 12 }} />
      </Card>

      <SectionHeader title={isDietitian ? 'Bugünkü randevular' : 'Bugünkü dersler'} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {todays.map((a, i) => (
          <ListRow
            key={a.id}
            icon={a.kind === 'online' ? 'videocam-outline' : 'people-outline'}
            title={`${a.time} · ${a.clientName}`}
            subtitle={`${a.title} · ${a.kind === 'online' ? 'Online' : 'Yüz yüze'}`}
            last={i === todays.length - 1}
          />
        ))}
        {todays.length === 0 ? (
          <Text variant="caption" tone="muted" style={{ paddingVertical: 14 }}>
            Bugün için kayıtlı randevu yok.
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Hatırlatıcılar" />
      {reminders.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {reminders.map((r, i) => (
            <ListRow
              key={r.key}
              icon="notifications-outline"
              title={r.title}
              subtitle={r.subtitle}
              trailing={<Tag label={r.tag[0]} kind={r.tag[1]} />}
              onPress={() => router.push(`/client/${r.clientId}`)}
              last={i === reminders.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Notice kind="success" text="Her şey yolunda, bekleyen hatırlatıcı yok." />
      )}

      <Notice kind="info" text="Danışanlar, bir kullanıcıyla mesajlaşırken 'Danışan olarak ekle' ile eklenir. Danışan, hangi verilerini paylaşacağını kendisi seçer." />
    </Screen>
  );
}
