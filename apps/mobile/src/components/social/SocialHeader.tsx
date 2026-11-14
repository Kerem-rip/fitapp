// Sosyal arayüzün üst çubuğu: solda ☰ menü, ortada başlık, sağda mesajlar (DM).
// Bildirim sayısı ☰ üzerinde görünür (bildirimler menünün içindedir).
import { IconButton, ScreenHeader } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { SocialMenu } from './SocialMenu';

export function SocialHeader({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dm, setDm] = useState(0);

  useFocusEffect(
    useCallback(() => {
      api
        .notifications(1)
        .then((res) => setUnread(res.unread))
        .catch(() => setUnread(0));
      api
        .dmUnread()
        .then((r) => setDm(r.unread + r.requests))
        .catch(() => setDm(0));
    }, []),
  );

  return (
    <>
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        leading={<IconButton icon="menu-outline" label="Menü" badge={unread} onPress={() => setMenuOpen(true)} />}
        trailing={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {extra}
            <IconButton icon="paper-plane-outline" label="Mesajlar" badge={dm} onPress={() => router.push('/messages')} />
          </View>
        }
      />
      <SocialMenu visible={menuOpen} onClose={() => setMenuOpen(false)} unread={unread} />
    </>
  );
}
