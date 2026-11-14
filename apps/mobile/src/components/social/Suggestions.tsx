// Takip önerileri (yatay kartlar): ortak takip, benzer ilgi alanı ya da doğrulanmış uzman.
import type { FollowState, UserCard } from '@fitapp/api-client';
import { Text, useTheme } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import { BadgeTag } from './BadgeTag';
import { FollowButton } from './FollowButton';
import { UserAvatar } from './UserAvatar';

type Suggestion = UserCard & { reason: string; following?: FollowState };

export function Suggestions() {
  const router = useRouter();
  const { c } = useTheme();
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    api
      .suggestions()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text variant="subheading" style={{ marginBottom: 8 }}>
        Tanıyor olabileceğin kişiler
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {items.map((p) => (
          <View key={p.id} style={{ width: 150, backgroundColor: c.surface, borderRadius: 16, padding: 12, alignItems: 'center' }}>
            <Pressable onPress={() => router.push(`/u/${p.username}`)} style={{ alignItems: 'center' }} accessibilityRole="link">
              <UserAvatar name={p.displayName} url={p.avatarUrl} size={56} />
              <Text variant="bodyStrong" numberOfLines={1} style={{ marginTop: 6 }}>
                {p.displayName}
              </Text>
              {p.badges[0] ? <BadgeTag badge={p.badges[0]} /> : null}
              <Text variant="micro" tone="muted" numberOfLines={1} style={{ marginTop: 2, marginBottom: 8 }}>
                {p.reason}
              </Text>
            </Pressable>
            <FollowButton userId={p.id} state={p.following ?? 'NONE'} size="sm" block onChange={(s) => setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, following: s } : x)))} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
