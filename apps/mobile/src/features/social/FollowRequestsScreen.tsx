// Gelen takip istekleri (gizli hesap): kabul et ya da reddet.
import type { UserCard } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, Screen, ScreenHeader, showToast } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { PersonRow } from '@/components/social/PersonRow';

export function FollowRequestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<UserCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (after?: string) => {
    try {
      const page = await api.followRequests(after);
      setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void fetchPage();
    }, [fetchPage]),
  );

  const answer = async (id: string, accept: boolean) => {
    try {
      if (accept) await api.acceptFollow(id);
      else await api.declineFollow(id);
      setItems((prev) => prev?.filter((p) => p.id !== id) ?? null);
      showToast(accept ? 'İstek kabul edildi' : 'İstek reddedildi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Takip istekleri" onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {items && items.length === 0 ? <EmptyState icon="person-add-outline" title="Bekleyen istek yok" text="Hesabın gizliyken seni takip etmek isteyenler burada görünür." /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              last={i === items.length - 1}
              trailing={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button label="Onayla" size="sm" onPress={() => answer(p.id, true)} />
                  <Button label="Sil" size="sm" variant="secondary" onPress={() => answer(p.id, false)} />
                </View>
              }
            />
          ))}
        </Card>
      ) : null}
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => fetchPage(cursor)} /> : null}
    </Screen>
  );
}
