// Takipçiler / Takip edilenler listesi (sayfalı). Her satırda bakan kişinin takip düğmesi.
import type { FollowState, UserCard } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, Screen, ScreenHeader } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { FollowButton } from '@/components/social/FollowButton';
import { PersonRow } from '@/components/social/PersonRow';

type Kind = 'followers' | 'following';
type Person = UserCard & { isMe: boolean; following: FollowState };

export function FollowListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; kind?: Kind; username?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'following' ? 'following' : 'followers');
  const [items, setItems] = useState<Person[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (after?: string) => {
      try {
        const page = kind === 'followers' ? await api.followers(params.userId, after) : await api.following(params.userId, after);
        setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        setError(errorText(e));
      }
    },
    [kind, params.userId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchPage();
    }, [fetchPage]),
  );

  const setState = (id: string, following: FollowState) => setItems((prev) => prev?.map((p) => (p.id === id ? { ...p, following } : p)) ?? null);

  return (
    <Screen>
      <ScreenHeader title={params.username ? `@${params.username}` : 'Takip'} onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <ChipRow
        options={[
          { key: 'followers' as const, label: 'Takipçiler' },
          { key: 'following' as const, label: 'Takip edilenler' },
        ]}
        selected={[kind]}
        onToggle={(k) => {
          setItems(null);
          setKind(k);
        }}
      />
      {error ? <Notice kind="warning" text={error} /> : null}
      {items && items.length === 0 ? <EmptyState icon="people-outline" title={kind === 'followers' ? 'Henüz takipçi yok' : 'Henüz kimseyi takip etmiyor'} /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 12 }}>
          {items.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              last={i === items.length - 1}
              trailing={p.isMe ? undefined : <FollowButton userId={p.id} state={p.following} size="sm" onChange={(s) => setState(p.id, s)} />}
            />
          ))}
        </Card>
      ) : null}
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => fetchPage(cursor)} /> : null}
    </Screen>
  );
}
