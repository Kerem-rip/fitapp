// Kişi satırı (takipçi listesi, istekler, engellenenler): fotoğraf, ad, rozet, kullanıcı adı ve sağda işlem.
import type { UserCard } from '@fitapp/api-client';
import { Text, useTheme } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { BadgeTag } from './BadgeTag';
import { UserAvatar } from './UserAvatar';

export function PersonRow({ person, trailing, last = false, linked = true }: { person: UserCard; trailing?: ReactNode; last?: boolean; linked?: boolean }) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <Pressable
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        onPress={linked ? () => router.push(`/u/${person.username}`) : undefined}
        disabled={!linked}
        accessibilityRole={linked ? 'link' : undefined}
      >
        <UserAvatar name={person.displayName} url={person.avatarUrl} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {person.displayName}
            </Text>
            {person.badges.map((b) => (
              <BadgeTag key={b.kind} badge={b} />
            ))}
          </View>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            @{person.username}
          </Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
