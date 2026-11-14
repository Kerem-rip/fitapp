// Mesajlar (sosyal DM): Gelen kutusu ve İstekler. Uzman–danışan yazışması burada yer almaz.
import type { DmConversationItem } from '@fitapp/api-client';
import { EmptyState, IconButton, Notice, Screen, ScreenHeader, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { UserAvatar } from '@/components/social/UserAvatar';
import { timeAgo } from '@/demo/dates';
import { useDmEvents } from './useDmEvents';

type Box = 'inbox' | 'requests';

export function DmInboxScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const [box, setBox] = useState<Box>('inbox');
  const [items, setItems] = useState<DmConversationItem[] | null>(null);
  const [requests, setRequests] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, counts] = await Promise.all([api.dmConversations(box), api.dmUnread()]);
      setItems(list);
      setRequests(counts.requests);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [box]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useDmEvents(() => void load());

  return (
    <Screen>
      <ScreenHeader
        title="Mesajlar"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        trailing={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton icon="people-outline" label="Yeni grup" onPress={() => router.push({ pathname: '/dm-new', params: { mode: 'group' } })} />
            <IconButton icon="create-outline" label="Yeni mesaj" onPress={() => router.push('/dm-new')} />
          </View>
        }
      />
      <ChipRow
        options={[
          { key: 'inbox' as const, label: 'Gelen kutusu' },
          { key: 'requests' as const, label: requests ? `İstekler (${requests})` : 'İstekler' },
        ]}
        selected={[box]}
        onToggle={(b) => {
          setItems(null);
          setBox(b);
        }}
      />
      <View style={{ height: 8 }} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {box === 'requests' && items?.length ? <Notice kind="info" text="Takip etmediğin kişilerden gelen mesajlar. Kabul edene kadar okuduğun görünmez; fotoğraf ve video gönderemezler." /> : null}
      {items && items.length === 0 ? (
        <EmptyState
          icon="paper-plane-outline"
          title={box === 'inbox' ? 'Henüz mesajın yok' : 'Bekleyen istek yok'}
          text={box === 'inbox' ? 'Sağ üstten yeni bir mesaj ya da grup başlatabilirsin.' : undefined}
        />
      ) : null}
      {items?.map((cv) => (
        <Pressable
          key={cv.id}
          onPress={() => router.push(`/dm/${cv.id}`)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}
        >
          <View>
            <UserAvatar name={cv.title} url={cv.avatarUrl} size={52} />
            {cv.other?.online ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: c.success, borderWidth: 2, borderColor: c.background }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {cv.title}
              {cv.kind === 'GROUP' ? ` · ${cv.memberCount} kişi` : ''}
              {cv.muted ? ' 🔕' : ''}
            </Text>
            <Text variant="caption" tone={cv.unread ? 'primary' : 'secondary'} numberOfLines={1} style={cv.unread ? { fontWeight: '700' } : undefined}>
              {cv.lastMessage.preview}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="micro" tone="muted">
              {timeAgo(cv.lastMessage.at)}
            </Text>
            {cv.unread ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                <Text variant="micro" style={{ color: '#FFFFFF' }}>
                  {cv.unread > 99 ? '99+' : cv.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
