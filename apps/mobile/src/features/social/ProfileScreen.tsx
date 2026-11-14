// Profil sekmesi (sosyal): fotoğraf, görünen ad, doğrulanmış rozet, biyografi, ilgi alanları, bağlantılar ve sayılar.
// Paylaşım (gönderi, hikâye) da buradan başlar. Sağlık ve danışan bilgisi burada hiçbir zaman görünmez.
import type { SocialProfile } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Chip, ListRow, Screen, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/auth-store';
import { BadgeTag } from '@/components/social/BadgeTag';
import { SocialHeader } from '@/components/social/SocialHeader';
import { UserAvatar } from '@/components/social/UserAvatar';
import { UserPosts } from '@/components/social/UserPosts';

export function ProfileScreen() {
  const router = useRouter();
  const me = useAuth().me;
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [requests, setRequests] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      api
        .socialProfile(me.username)
        .then(setProfile)
        .catch(() => setProfile(null));
      api
        .followRequestCount()
        .then((r) => setRequests(r.count))
        .catch(() => setRequests(0));
    }, [me]),
  );

  if (!me) return null;

  return (
    <Screen tabBarInset>
      <SocialHeader title="Profil" />
      <ProfileHeader
        name={me.displayName}
        username={me.username}
        avatarUrl={me.avatarUrl}
        badges={me.badges}
        isPrivate={me.isPrivate}
        bio={me.bio}
        city={me.city}
        goals={me.goals}
        sports={me.sports}
        links={me.links}
        counts={profile?.counts ?? null}
        onCounts={(kind) => router.push({ pathname: '/follow-list', params: { userId: me.id, kind, username: me.username } })}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Button label="Paylaş" icon="add-circle-outline" block onPress={() => setShareOpen(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Profili düzenle" variant="secondary" block onPress={() => router.push('/profile-edit')} />
        </View>
      </View>
      {requests > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <ListRow icon="person-add-outline" title="Takip istekleri" subtitle={` kişi seni takip etmek istiyor`} onPress={() => router.push('/follow-requests')} last />
        </Card>
      ) : null}
      <UserPosts userId={me.id} emptyText="İlk gönderini Paylaş düğmesiyle oluşturabilirsin." />

      <BottomSheet visible={shareOpen} onClose={() => setShareOpen(false)} title="Ne paylaşmak istersin?">
        <ListRow
          icon="images-outline"
          title="Gönderi"
          subtitle="Fotoğraf ve açıklama"
          onPress={() => {
            setShareOpen(false);
            router.push('/compose');
          }}
        />
        <ListRow
          icon="aperture-outline"
          title="Hikâye"
          subtitle="24 saat görünür"
          onPress={() => {
            setShareOpen(false);
            router.push('/story-create');
          }}
        />
        <ListRow
          icon="text-outline"
          title="Metin"
          subtitle="Sadece yazı"
          onPress={() => {
            setShareOpen(false);
            router.push('/compose');
          }}
          last
        />
      </BottomSheet>
    </Screen>
  );
}

// Kendi profilinde ve başkasının profilinde ortak başlık
export function ProfileHeader({
  name,
  username,
  avatarUrl,
  badges,
  isPrivate,
  bio,
  city,
  goals,
  sports,
  links,
  counts,
  onCounts,
}: {
  name: string;
  username: string;
  avatarUrl: string | null;
  badges: SocialProfile['badges'];
  isPrivate: boolean;
  bio: string | null;
  city: string | null;
  goals: string | null;
  sports: SocialProfile['sports'];
  links: SocialProfile['links'];
  counts: SocialProfile['counts'] | null;
  onCounts?: (which: 'followers' | 'following') => void;
}) {
  const { c } = useTheme();
  const stat = (value: number | undefined, label: string, which?: 'followers' | 'following') => (
    <Pressable
      onPress={which && onCounts ? () => onCounts(which) : undefined}
      disabled={!which || !onCounts}
      accessibilityRole={which && onCounts ? 'button' : undefined}
      style={{ alignItems: 'center', minWidth: 72 }}
    >
      <Text variant="heading">{value === undefined ? '—' : value.toLocaleString('tr-TR')}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <UserAvatar name={name} url={avatarUrl} size={84} />
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
          {stat(counts?.followers, 'Takipçi', 'followers')}
          {stat(counts?.following, 'Takip', 'following')}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <Text variant="title">{name}</Text>
        {badges.map((b) => (
          <BadgeTag key={b.kind} badge={b} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Text variant="caption" tone="secondary">
          @{username}
          {city ? ` · ${city}` : ''}
        </Text>
        {isPrivate ? <Tag label="Gizli hesap" kind="neutral" icon="lock-closed" /> : null}
      </View>
      {bio ? (
        <Text variant="body" style={{ marginTop: 10 }}>
          {bio}
        </Text>
      ) : null}
      {goals ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
          Hedef: {goals}
        </Text>
      ) : null}
      {sports.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {sports.map((s) => (
            <Chip key={s.id} label={s.name} />
          ))}
        </View>
      ) : null}
      {links.map((l) => (
        <Pressable key={l.url} onPress={() => void Linking.openURL(l.url)} accessibilityRole="link" style={{ marginTop: 6 }}>
          <Text variant="caption" style={{ color: c.info, fontWeight: '600' }}>
            {l.label} · {l.url.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
