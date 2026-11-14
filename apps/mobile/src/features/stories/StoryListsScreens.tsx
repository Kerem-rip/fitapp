// Yakın arkadaşlar listesi ve hikâye arşivi.
import type { StoryItem, UserCard } from '@fitapp/api-client';
import { Button, Card, EmptyState, Screen, ScreenHeader, SectionHeader, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/media';
import { errorText } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { formatShort } from '@/demo/dates';
import { PersonRow } from '@/components/social/PersonRow';
import { backgroundColor } from './story-style';

// Yakın arkadaşlar: listedekiler "Yakın arkadaşlar" hikâyelerini görür; listede olduklarını bilmezler
export function CloseFriendsScreen() {
  const router = useRouter();
  const me = useAuth().me;
  const [friends, setFriends] = useState<UserCard[]>([]);
  const [followers, setFollowers] = useState<UserCard[]>([]);

  const load = useCallback(() => {
    if (!me) return;
    Promise.all([api.closeFriends(), api.followers(me.id)])
      .then(([f, fol]) => {
        setFriends(f);
        setFollowers(fol.items);
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  }, [me]);
  useFocusEffect(load);

  const toggle = async (p: UserCard, on: boolean) => {
    try {
      await api.setCloseFriend(p.id, on);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const candidates = followers.filter((f) => !friends.some((x) => x.id === f.id));

  return (
    <Screen>
      <ScreenHeader title="Yakın arkadaşlar" onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <Text variant="caption" tone="secondary">
        Listedekiler &quot;Yakın arkadaşlar&quot; kitleli hikâyelerini görür. Listeye eklendiklerine dair bildirim almazlar.
      </Text>
      <SectionHeader title={`Listen (${friends.length})`} />
      {friends.length === 0 ? <EmptyState icon="star-outline" title="Listen boş" /> : null}
      {friends.length ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {friends.map((p, i) => (
            <PersonRow key={p.id} person={p} last={i === friends.length - 1} trailing={<Button label="Çıkar" size="sm" variant="secondary" onPress={() => toggle(p, false)} />} />
          ))}
        </Card>
      ) : null}
      <SectionHeader title="Takipçilerinden ekle" />
      {candidates.length === 0 ? (
        <Text variant="caption" tone="muted">
          Eklenecek takipçin yok.
        </Text>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {candidates.map((p, i) => (
            <PersonRow key={p.id} person={p} last={i === candidates.length - 1} trailing={<Button label="Ekle" size="sm" onPress={() => toggle(p, true)} />} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

// Arşiv: süresi dolmuş olanlar dahil kendi hikâyeleri (sadece sen görürsün)
export function StoryArchiveScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [items, setItems] = useState<StoryItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback(async (after?: string) => {
    const page = await api.storyArchive(after).catch(() => ({ items: [], nextCursor: null }));
    setItems((prev) => (after && prev ? [...prev, ...page.items] : page.items));
    setCursor(page.nextCursor);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ScreenHeader title="Hikâye arşivi" subtitle="Sadece sen görürsün" onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      {items && items.length === 0 ? <EmptyState icon="archive-outline" title="Arşivin boş" text="Paylaştığın hikâyeler 24 saat sonra burada saklanır." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items?.map((s) => (
          <View key={s.id} style={{ width: '31%', aspectRatio: 9 / 16, borderRadius: 12, overflow: 'hidden', backgroundColor: s.media ? c.surfaceAlt : backgroundColor(s.background), justifyContent: 'flex-end' }}>
            {s.media?.kind === 'IMAGE' ? <Image source={{ uri: mediaUrl(s.media.url) ?? undefined }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
            {!s.media && s.text ? (
              <Text variant="micro" numberOfLines={4} style={{ color: '#FFFFFF', padding: 6 }}>
                {s.text}
              </Text>
            ) : null}
            <Text variant="micro" style={{ color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 6, paddingVertical: 2 }}>
              {formatShort(s.createdAt.slice(0, 10))} · {s.counts?.views ?? 0} izleyen
            </Text>
          </View>
        ))}
      </View>
      {cursor ? <Button label="Daha fazla" variant="ghost" onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}
