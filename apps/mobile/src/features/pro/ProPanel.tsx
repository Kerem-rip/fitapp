// Panel (diyetisyen ve bağımsız eğitmen): günün randevuları, inceleme bekleyen danışanlar ve görevler.
// Sayaçlar ve "sıradaki" randevu sunucudaki gerçek kayıtlardan gelir. Örnek danışanlar sadece demo kutusunda görünür.
import type { AgendaResponse } from '@fitapp/api-client';
import { Button, Card, ListRow, Notice, Screen, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { AppHeader } from '@/components/AppHeader';
import { DemoBlock } from '@/components/DemoBlock';
import { formatLong } from '@/demo/dates';
import { useAccount, useDemoState, useToday } from '@/demo/hooks';
import { RealAgenda } from '@/features/agenda/RealAgenda';
import { formatTime, MODE_LABELS, startOfDay } from '@/features/agenda/helpers';
import { RealWorkQueue } from './RealWorkQueue';
import { useClients } from './useClients';

// Aktif danışan sayısı ve bugünkü randevular (sunucu)
function useRealPanel() {
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  useFocusEffect(
    useCallback(() => {
      api
        .relationshipsAsProfessional('ACTIVE')
        .then((list) => setClientCount(list.length))
        .catch(() => setClientCount(null));
      api
        .agenda(startOfDay().toISOString(), startOfDay(1).toISOString())
        .then(setAgenda)
        .catch(() => setAgenda(null));
    }, []),
  );
  return { clientCount, agenda };
}

export function ProPanel() {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const today = useToday();
  const clients = useClients();
  const { clientCount, agenda } = useRealPanel();

  const isDietitian = account?.roleKey === 'dietitian';

  const todays = (agenda?.appointments ?? []).filter((a) => a.status === 'SCHEDULED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const now = new Date().toISOString();
  const next = todays.find((a) => new Date(new Date(a.startsAt).getTime() + a.durationMin * 60_000).toISOString() > now);

  // Örnek veri: demo danışanların randevuları ve hatırlatıcıları
  const demoTodays = useMemo(
    () => state.shared.appointments.filter((a) => a.ownerId === account?.id && a.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [state.shared.appointments, account?.id, today],
  );
  const reminders = useMemo(() => {
    const list: { key: string; title: string; subtitle: string; tag: [string, 'warning' | 'accent']; clientId: string }[] = [];
    for (const item of clients) {
      if (item.needsAttention) {
        list.push({
          key: `att-${item.link.id}`,
          title: isDietitian ? `${item.view.name} ${item.view.lastEntryDaysAgo} gündür kayıt girmedi` : `${item.view.name} bu hafta antrenmanı atladı`,
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

  return (
    <Screen tabBarInset>
      <AppHeader title={`Günaydın, ${account.firstName}`} subtitle={`${formatLong(today)} · ${todays.length} randevun var`} showMessages={!isDietitian} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Danışan" value={clientCount === null ? '—' : String(clientCount)} sub="aktif" icon="people-outline" />
        <StatTile label="Bugün" value={String(todays.length)} sub={isDietitian ? 'randevu' : 'ders'} icon="calendar-outline" />
      </View>

      <Card variant="accent">
        <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
          SIRADAKİ
        </Text>
        {next ? (
          <>
            <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
              {formatTime(next.startsAt)} · {next.client.name}
            </Text>
            <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
              {next.title ?? 'Randevu'} · {MODE_LABELS[next.mode]} · {next.durationMin} dk
            </Text>
          </>
        ) : (
          <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
            Bugün başka randevu yok
          </Text>
        )}
        <Button label="Ajandayı aç" variant="light" size="sm" icon="calendar-outline" onPress={() => router.push(isDietitian ? '/(dietitian)/agenda' : '/(trainer)/agenda')} style={{ marginTop: 12 }} />
      </Card>

      <RealWorkQueue />
      <RealAgenda days={1} title="Bugünkü randevularım" showTasks={false} />

      <SectionHeader title="Danışan teklifleri" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow
          icon="person-add-outline"
          title="Danışan ekle"
          subtitle="Kullanıcı adıyla teklif gönder. Danışan hangi bilgilerini paylaşacağını kendisi seçer."
          onPress={() => router.push('/my-clients')}
          last
        />
      </Card>

      <DemoBlock note="Aşağıdaki danışanlar, randevular ve hatırlatıcılar örnektir; gerçek danışanların değildir. Yayın sürümünde görünmez.">
        <SectionHeader title={isDietitian ? 'Örnek randevular' : 'Örnek dersler'} />
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {demoTodays.map((a, i) => (
            <ListRow
              key={a.id}
              icon={a.kind === 'online' ? 'videocam-outline' : 'people-outline'}
              title={`${a.time} · ${a.clientName}`}
              subtitle={`${a.title} · ${a.kind === 'online' ? 'Online' : 'Yüz yüze'}`}
              last={i === demoTodays.length - 1}
            />
          ))}
          {demoTodays.length === 0 ? (
            <Text variant="caption" tone="muted" style={{ paddingVertical: 14 }}>
              Örnek randevu yok.
            </Text>
          ) : null}
        </Card>

        <SectionHeader title="Örnek hatırlatıcılar" />
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
          <Notice kind="success" text="Örnek hatırlatıcı yok." />
        )}
      </DemoBlock>
    </Screen>
  );
}
