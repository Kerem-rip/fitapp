// Akışın üstündeki hikâye şeridi: önce kendi hikâyen (yoksa "+"), sonra görülmemiş hikâyeler.
import type { StoryTrayItem } from '@fitapp/api-client';
import { Icon, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/auth-store';
import { UserAvatar } from './UserAvatar';

export function StoryTray() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const me = useAuth().me;
  const [items, setItems] = useState<StoryTrayItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      api
        .storyTray()
        .then(setItems)
        .catch(() => setItems([]));
    }, []),
  );

  if (!me) return null;
  const mine = items.find((i) => i.isMe);
  const others = items.filter((i) => !i.isMe);

  const bubble = (key: string, name: string, url: string | null, ring: 'unseen' | 'seen' | 'none', label: string, onPress: () => void, plus = false, caption = name) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', width: 72 }}>
      <View style={{ padding: 2, borderRadius: 36, borderWidth: 2, borderColor: ring === 'unseen' ? accent : ring === 'seen' ? c.border : 'transparent' }}>
        <UserAvatar name={name} url={url} size={58} />
        {plus ? (
          <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: accent, borderRadius: 11, borderWidth: 2, borderColor: c.background }}>
            <Icon name="add" size={16} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Text variant="micro" numberOfLines={1} style={{ marginTop: 4, maxWidth: 70 }}>
        {caption}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
      {mine
        ? bubble('me', me.displayName, me.avatarUrl, 'seen', 'Hikâyeni gör', () => router.push(`/stories/${me.id}`), false, 'Hikâyen')
        : bubble('me', me.displayName, me.avatarUrl, 'none', 'Hikâye ekle', () => router.push('/story-create'), true, 'Hikâyen')}
      {others.map((i) =>
        bubble(i.author.id, i.author.displayName, i.author.avatarUrl, i.hasUnseen ? 'unseen' : 'seen', `${i.author.displayName} hikâyesi`, () => router.push(`/stories/${i.author.id}`)),
      )}
    </ScrollView>
  );
}
