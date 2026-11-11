// Salonun "bugün" paneli (gerçek veri): biten/bitmiş üyelikler, bugünkü tahsilat ve borçlar.
// Para bilgisi sadece sahip ve resepsiyona gelir; eğitmen sadece üyelik durumlarını görür.
import type { GymTodayPanel } from '@fitapp/api-client';
import { Card, ListRow, Notice, SectionHeader, StatTile, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatTL, GYM_ROLE_LABELS, METHOD_LABELS } from './labels';

export function RealGymToday() {
  const router = useRouter();
  const [panel, setPanel] = useState<GymTodayPanel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .gymToday()
        .then((p) => {
          setPanel(p);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  if (error) return <Notice kind="warning" text={error} />;
  if (!panel) return null;
  const openMember = (id: string) => router.push(`/gym-member/${id}`);
  const collections = panel.todayCollections;
  const methods = collections ? (Object.entries(collections.byMethod) as [keyof typeof METHOD_LABELS, number][]).filter(([, v]) => v > 0) : [];

  return (
    <>
      <Card variant="accent">
        <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
          {panel.gymName.toLocaleUpperCase('tr-TR')} · {GYM_ROLE_LABELS[panel.role].toLocaleUpperCase('tr-TR')}
        </Text>
        <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
          {panel.activeMembers} aktif üye
        </Text>
        <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
          {panel.expiring.length} üyelik 7 gün içinde bitiyor · {panel.expired.length} üyelik yeni bitti
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <StatTile label="Ekip" value={String(panel.staffCount)} sub="kişi" icon="people-outline" />
        {collections ? <StatTile label="Bugün" value={formatTL(collections.totalKurus)} sub={`${collections.count} ödeme`} icon="cash-outline" /> : null}
        {panel.debts ? <StatTile label="Borçlu" value={String(panel.debts.length)} sub="üye" icon="alert-circle-outline" /> : null}
      </View>
      {methods.length > 0 ? (
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          Bugünkü kayıtlar: {methods.map(([k, v]) => `${METHOD_LABELS[k]} ${formatTL(v)}`).join(' · ')}
        </Text>
      ) : null}

      {panel.expiring.length > 0 ? (
        <>
          <SectionHeader title="Üyeliği bitmek üzere" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {panel.expiring.map((m, i) => (
              <ListRow
                key={m.memberId}
                avatar={m.fullName}
                title={m.fullName}
                subtitle={`${m.planName}${m.sessionsLeft !== null ? ` · ${m.sessionsLeft} ders kaldı` : ''}`}
                trailing={<Tag label={m.daysLeft === 0 ? 'Bugün bitiyor' : `${m.daysLeft} gün`} kind="warning" />}
                onPress={() => openMember(m.memberId)}
                last={i === panel.expiring.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {panel.expired.length > 0 ? (
        <>
          <SectionHeader title="Üyeliği yeni biten" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {panel.expired.map((m, i) => (
              <ListRow
                key={m.memberId}
                avatar={m.fullName}
                title={m.fullName}
                subtitle={m.planName}
                trailing={<Tag label="Süresi doldu" kind="danger" />}
                onPress={() => openMember(m.memberId)}
                last={i === panel.expired.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {panel.debts && panel.debts.length > 0 ? (
        <>
          <SectionHeader title="Kalan ödemeler" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {panel.debts.slice(0, 8).map((d, i, list) => (
              <ListRow
                key={d.memberId}
                avatar={d.fullName}
                title={d.fullName}
                trailing={<Tag label={formatTL(d.balanceKurus)} kind="warning" />}
                onPress={() => openMember(d.memberId)}
                last={i === list.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {panel.expiring.length + panel.expired.length === 0 && !panel.debts?.length ? <Notice kind="success" text="Bugün takip edilecek üyelik yok." /> : null}
      {collections ? (
        <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
          Ödemeler sadece kayıttır; uygulama üzerinden para alınmaz.
        </Text>
      ) : null}
    </>
  );
}
