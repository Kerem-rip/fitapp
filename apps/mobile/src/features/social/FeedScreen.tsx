// Akış: arama/keşfet en üstte, hikâyeler, ardından "Senin için" ya da "Takip ettiklerin" gönderileri.
import type { FeedMode, PostView } from '@fitapp/api-client';
import { Button, EmptyState, Icon, Screen, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { ChipRow } from '@/components/ChipRow';
import { PostCard } from '@/components/social/PostCard';
import { SocialHeader } from '@/components/social/SocialHeader';
import { StoryTray } from '@/components/social/StoryTray';
import { Suggestions } from '@/components/social/Suggestions';

const MODES: { key: FeedMode; label: string }[] = [
  { key: 'for_you', label: 'Senin için' },
  { key: 'following', label: 'Takip ettiklerin' },
];

export function FeedScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [items, setItems] = useState<PostView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (after?: string) => {
      try {
        const page = await api.feed(mode, after);
        setItems((prev) => (after && prev ? [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))] : page.items));
        setCursor(page.nextCursor);
      } catch {
        if (!after) setItems([]);
      }
    },
    [mode],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  };
  const replace = (next: PostView) => setItems((prev) => prev?.map((p) => (p.id === next.id ? next : p)) ?? null);
  const removed = (id: string) => setItems((prev) => prev?.filter((p) => p.id !== id) ?? null);

  return (
    <Screen tabBarInset>
      <SocialHeader title="Akış" />
      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 14, backgroundColor: c.surfaceAlt, marginBottom: 12 }}
      >
        <Icon name="search-outline" size={18} color={c.textMuted} />
        <Text variant="body" tone="muted">
          Kişi, gönderi, etiket, uzman ara
        </Text>
      </Pressable>
      <StoryTray />

      <ChipRow
        options={MODES}
        selected={[mode]}
        onToggle={(m) => {
          setItems(null);
          setCursor(null);
          setMode(m);
        }}
      />
      <View style={{ height: 12 }} />

      {items && items.length === 0 ? (
        <>
          <EmptyState
            icon="newspaper-outline"
            title={mode === 'following' ? 'Takip ettiklerinden paylaşım yok' : 'Akışın henüz boş'}
            text={mode === 'following' ? 'İlgini çeken kişileri takip et; paylaşımları burada görünür.' : 'Topluluk paylaştıkça burada görünecek.'}
          />
          <Suggestions />
        </>
      ) : null}
      {items?.map((p, i) => (
        <View key={p.id}>
          <PostCard post={p} onChange={replace} onRemoved={() => removed(p.id)} />
          {/* Öneriler akışta birkaç gönderinin altında bir kez görünür */}
          {i === 2 ? <Suggestions /> : null}
        </View>
      ))}
      {cursor ? <Button label={loadingMore ? 'Yükleniyor…' : 'Daha fazla'} variant="ghost" onPress={more} disabled={loadingMore} /> : null}
    </Screen>
  );
}
