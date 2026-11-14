// Profildeki gönderiler: önce sabitlenenler, sonra en yeniden eskiye. "Daha fazla" ile sayfalanır.
import type { PostView } from '@fitapp/api-client';
import { Button, EmptyState } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { PostCard } from './PostCard';

export function UserPosts({ userId, emptyText }: { userId: string; emptyText?: string }) {
  const [pinned, setPinned] = useState<PostView[]>([]);
  const [items, setItems] = useState<PostView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(
    async (after?: string) => {
      try {
        const page = await api.userPosts(userId, after);
        if (!after) setPinned(page.pinned);
        setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch {
        setItems([]);
      }
    },
    [userId],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const replace = (next: PostView) => {
    // Sabitleme değiştiyse listeyi baştan al
    const was = [...pinned, ...(items ?? [])].find((p) => p.id === next.id);
    if (was && was.pinned !== next.pinned) {
      void load();
      return;
    }
    setPinned((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    setItems((prev) => prev?.map((p) => (p.id === next.id ? next : p)) ?? null);
  };
  const removed = (id: string) => {
    setPinned((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev?.filter((p) => p.id !== id) ?? null);
  };

  if (items && items.length === 0 && pinned.length === 0) return <EmptyState icon="images-outline" title="Henüz paylaşım yok" text={emptyText} />;
  return (
    <View>
      {[...pinned, ...(items ?? [])].map((p) => (
        <PostCard key={p.id} post={p} onChange={replace} onRemoved={() => removed(p.id)} />
      ))}
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => load(cursor)} /> : null}
    </View>
  );
}
