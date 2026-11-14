// Engellenenler ve sessize alınanlar: buradan kaldırılır.
import type { UserCard } from '@fitapp/api-client';
import { Button, Card, EmptyState, Screen, ScreenHeader, SectionHeader, showToast } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { PersonRow } from '@/components/social/PersonRow';

export function BlockedScreen() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<UserCard[]>([]);
  const [mutes, setMutes] = useState<UserCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.blocks(), api.mutes()])
      .then(([b, m]) => {
        setBlocks(b);
        setMutes(m);
        setLoaded(true);
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  }, []);
  useFocusEffect(load);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      showToast(message);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Engellenenler ve sessize alınanlar" onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      <SectionHeader title="Engellenenler" />
      {loaded && blocks.length === 0 ? <EmptyState icon="ban-outline" title="Kimseyi engellemedin" /> : null}
      {blocks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {blocks.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              linked={false}
              last={i === blocks.length - 1}
              trailing={<Button label="Engeli kaldır" size="sm" variant="secondary" onPress={() => run(() => api.unblock(p.id), 'Engel kaldırıldı')} />}
            />
          ))}
        </Card>
      ) : null}

      <SectionHeader title="Sessize alınanlar" />
      {loaded && mutes.length === 0 ? <EmptyState icon="volume-mute-outline" title="Sessize aldığın kimse yok" /> : null}
      {mutes.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {mutes.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              last={i === mutes.length - 1}
              trailing={<Button label="Sessizden çıkar" size="sm" variant="secondary" onPress={() => run(() => api.unmute(p.id), 'Sessizden çıkarıldı')} />}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
