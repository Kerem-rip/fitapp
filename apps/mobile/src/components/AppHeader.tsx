// Ana sayfaların üst başlığı: avatar, selamlama, bildirim ve mesaj düğmeleri.
// Bildirim rozeti sunucudaki okunmamış bildirimleri sayar. Mesajlaşma henüz örnek veriyle çalıştığı için
// mesaj düğmesi ve örnek sayılar sadece demo araçları açıkken görünür.
import { Avatar, IconButton, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { DEMO_TOOLS } from '@/config/features';
import { useAccount, useDemoState } from '@/demo/hooks';
import { fullName, unreadNotifications, unreadTotal } from '@/demo/selectors';

export function AppHeader({
  title,
  subtitle,
  showMessages = true,
}: {
  title: string;
  subtitle?: string;
  showMessages?: boolean;
}) {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api
        .notifications(1)
        .then((res) => setUnread(res.unread))
        .catch(() => setUnread(0));
    }, []),
  );

  if (!account) return null;
  const demoUnread = DEMO_TOOLS ? unreadNotifications(state, account.id) : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, marginBottom: 8 }}>
      <Avatar name={fullName(account)} size={46} story />
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showMessages && DEMO_TOOLS ? (
        <IconButton icon="chatbubble-ellipses-outline" label="Mesajlar (örnek)" badge={unreadTotal(state, account.id)} onPress={() => router.push('/inbox')} />
      ) : null}
      <IconButton icon="notifications-outline" label="Bildirimler" badge={unread + demoUnread} onPress={() => router.push('/notifications')} />
    </View>
  );
}
