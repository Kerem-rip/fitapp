// Gönderiyi beğenenler ve Kaydedilenler listeleri.
import type { PostView, UserCard } from '@fitapp/api-client';
import { Button, Card, EmptyState, Screen, ScreenHeader } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { PersonRow } from '@/components/social/PersonRow';
import { PostCard } from '@/components/social/PostCard';

export function PostLikersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<UserCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback(
    async (after?: string) => {
      const page = await api.postLikers(id, after).catch(() => ({ items: [], nextCursor: null }));
      setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    },
    [id],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <Screen>
      <ScreenHeader title="Beğenenler" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {items && items.length === 0 ? <EmptyState icon="heart-outline" title="Henüz beğeni yok" /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((p, i) => (
            <PersonRow key={p.id} person={p} last={i === items.length - 1} />
          ))}
        </Card>
      ) : null}
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}

export function SavedPostsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PostView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback(async (after?: string) => {
    const page = await api.savedPosts(after).catch(() => ({ items: [], nextCursor: null }));
    setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
    setCursor(page.nextCursor);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const replace = (next: PostView) => setItems((prev) => (next.saved ? (prev?.map((p) => (p.id === next.id ? next : p)) ?? null) : (prev?.filter((p) => p.id !== next.id) ?? null)));
  return (
    <Screen>
      <ScreenHeader title="Kaydedilenler" subtitle="Sadece sen görürsün" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {items && items.length === 0 ? <EmptyState icon="bookmark-outline" title="Kaydettiğin gönderi yok" text="Gönderilerdeki yer imi simgesiyle kaydedebilirsin." /> : null}
      {items?.map((p) => (
        <PostCard key={p.id} post={p} onChange={replace} onRemoved={() => setItems((prev) => prev?.filter((x) => x.id !== p.id) ?? null)} />
      ))}
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}
