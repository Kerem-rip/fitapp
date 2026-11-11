// Ana sayfaların üst başlığı: avatar, selamlama, bildirim ve mesaj düğmeleri.
import { Avatar, IconButton, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
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
  if (!account) return null;

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
      {showMessages ? (
        <IconButton icon="chatbubble-ellipses-outline" label="Mesajlar" badge={unreadTotal(state, account.id)} onPress={() => router.push('/inbox')} />
      ) : null}
      <IconButton
        icon="notifications-outline"
        label="Bildirimler"
        badge={unreadNotifications(state, account.id)}
        onPress={() => router.push('/notifications')}
      />
    </View>
  );
}
