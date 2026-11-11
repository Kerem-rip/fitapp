// Salon davetlerim: bir salon beni ekibine davet ettiyse burada kabul eder ya da reddederim.
// Ekipteysem buradan ayrılabilirim.
import type { GymInviteItem, Me } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { GYM_ROLE_LABELS } from '@/features/gym/labels';
import { formatDay } from '@/features/sharing/labels';

export default function GymInvitesScreen() {
  const router = useRouter();
  const [invites, setInvites] = useState<GymInviteItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, m] = await Promise.all([api.myGymInvites(), api.me()]);
      setInvites(list);
      setMe(m);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (fn: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showToast(message);
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const staffGym = me?.gym && me.gym.role !== 'OWNER' ? me.gym : null;

  return (
    <Screen>
      <ScreenHeader title="Salon davetlerim" subtitle="Salon ekiplerine katılım" onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {staffGym ? (
        <>
          <SectionHeader title="Şu anki salonum" />
          <Card style={{ marginBottom: 12 }}>
            <Text variant="heading">{staffGym.name}</Text>
            <Text variant="caption" tone="secondary">
              {GYM_ROLE_LABELS[staffGym.role]}
            </Text>
            <Button
              label="Salon ekibinden ayrıl"
              variant="ghost"
              disabled={busy}
              onPress={() => act(() => api.leaveGym(), 'Salon ekibinden ayrıldın')}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
            />
          </Card>
        </>
      ) : null}

      {invites && invites.length === 0 ? <EmptyState icon="mail-open-outline" title="Bekleyen davet yok" text="Bir salon seni ekibine davet ettiğinde burada görünür." /> : null}
      {invites?.map((inv) => (
        <Card key={inv.id} style={{ marginBottom: 10 }}>
          <Text variant="heading">{inv.gym.name}</Text>
          <Text variant="caption" tone="secondary">
            {GYM_ROLE_LABELS[inv.role]} olarak{inv.gym.city ? ` · ${inv.gym.city}` : ''} · {formatDay(inv.invitedAt)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button label="Kabul et" style={{ flex: 1 }} disabled={busy || staffGym !== null} onPress={() => act(() => api.acceptGymInvite(inv.id), `${inv.gym.name} ekibine katıldın`)} />
            <Button label="Reddet" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => act(() => api.declineGymInvite(inv.id), 'Davet reddedildi')} />
          </View>
        </Card>
      ))}
      {staffGym && invites && invites.length > 0 ? <Notice kind="info" text="Yeni bir daveti kabul etmek için önce şu anki salonundan ayrılmalısın." /> : null}
      <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
        Salon ekibine katılınca salon sahibi senin sağlık verini görmez; sen de salonun üye kayıtlarını görevinin izin verdiği kadar görürsün.
      </Text>
    </Screen>
  );
}
