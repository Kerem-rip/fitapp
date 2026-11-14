// Başkasının sosyal profili: başlık, takip düğmesi, mesaj ve "…" menüsü (sessize al, takipçiyi çıkar, engelle).
// Gizli hesapta takip kabul edilene kadar paylaşımlar görünmez.
import type { SocialProfile } from '@fitapp/api-client';
import { BottomSheet, Button, EmptyState, IconButton, ListRow, Notice, Screen, ScreenHeader, showToast, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { FollowButton } from '@/components/social/FollowButton';
import { ReportSheet } from '@/components/social/ReportSheet';
import { UserPosts } from '@/components/social/UserPosts';
import { ProfileHeader } from './ProfileScreen';

export function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    api
      .socialProfile(username)
      .then((p) => {
        // Kendi profiline gelindiyse Profil sekmesine geç
        if (p.isMe) router.replace('/profile');
        else setProfile(p);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [username, router]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const act = async (fn: () => Promise<unknown>, message: string) => {
    setMenu(false);
    try {
      await fn();
      showToast(message);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const rel = profile?.relation;
  return (
    <Screen>
      <ScreenHeader
        title={profile ? `@${profile.username}` : 'Profil'}
        onBack={back}
        trailing={profile ? <IconButton icon="ellipsis-horizontal" label="Diğer işlemler" onPress={() => setMenu(true)} /> : undefined}
      />
      {error ? <EmptyState icon="person-outline" title="Profil bulunamadı" text="Hesap kapatılmış ya da artık görüntülenemiyor olabilir." /> : null}
      {profile && rel ? (
        <>
          <ProfileHeader
            name={profile.displayName}
            username={profile.username}
            avatarUrl={profile.avatarUrl}
            badges={profile.badges}
            isPrivate={profile.isPrivate}
            bio={profile.bio}
            city={profile.city}
            goals={profile.goals}
            sports={profile.sports}
            links={profile.links}
            counts={profile.counts}
            onCounts={profile.canSeeContent ? (kind) => router.push({ pathname: '/follow-list', params: { userId: profile.id, kind, username: profile.username } }) : undefined}
          />
          {rel.followsMe ? (
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
              Seni takip ediyor
            </Text>
          ) : null}
          {rel.requestedMe ? (
            <Notice kind="info" text="Bu kişi seni takip etmek istiyor." />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <FollowButton userId={profile.id} state={rel.following} followsMe={rel.followsMe} block onChange={load} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Mesaj"
                variant="secondary"
                block
                onPress={async () => {
                  try {
                    const c = await api.dmOpenDirect(profile.id);
                    router.push(`/dm/${c.id}`);
                  } catch (e) {
                    showToast(errorText(e), 'warning');
                  }
                }}
              />
            </View>
          </View>
          {rel.requestedMe ? (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Button label="İsteği kabul et" size="sm" block onPress={() => act(() => api.acceptFollow(profile.id), 'İstek kabul edildi')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Reddet" size="sm" variant="secondary" block onPress={() => act(() => api.declineFollow(profile.id), 'İstek reddedildi')} />
              </View>
            </View>
          ) : null}

          {profile.canSeeContent ? (
            <UserPosts userId={profile.id} />
          ) : (
            <EmptyState icon="lock-closed-outline" title="Bu hesap gizli" text="Paylaşımlarını görmek için takip et. İsteğin kabul edilince görünür." />
          )}
        </>
      ) : null}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={profile?.displayName ?? ''}>
        {profile && rel ? (
          <>
            <ListRow
              icon={rel.muted ? 'volume-high-outline' : 'volume-mute-outline'}
              title={rel.muted ? 'Sessizden çıkar' : 'Sessize al'}
              subtitle={rel.muted ? undefined : 'Paylaşımları akışında görünmez; bunu bilmez.'}
              onPress={() => act(() => (rel.muted ? api.unmute(profile.id) : api.mute(profile.id)), rel.muted ? 'Sessizden çıkarıldı' : 'Sessize alındı')}
            />
            {rel.followsMe ? (
              <ListRow icon="person-remove-outline" title="Takipçilerimden çıkar" onPress={() => act(() => api.removeFollower(profile.id), 'Takipçilerinden çıkarıldı')} />
            ) : null}
            <ListRow
              icon="flag-outline"
              title="Şikâyet et"
              onPress={() => {
                setMenu(false);
                setReporting(true);
              }}
            />
            <ListRow
              icon="ban-outline"
              title="Engelle"
              onPress={() => {
                setMenu(false);
                setConfirmBlock(true);
              }}
              last
            />
          </>
        ) : null}
      </BottomSheet>

      <ReportSheet target={reporting && profile ? { type: 'USER', id: profile.id } : null} onClose={() => setReporting(false)} />

      <BottomSheet visible={confirmBlock} onClose={() => setConfirmBlock(false)} title={`@${profile?.username ?? ''} engellensin mi?`}>
        <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
          Profilini ve paylaşımlarını göremez, seni takip edemez ve sana mesaj gönderemez. Aranızdaki takipler kalkar. Engellendiğine dair bildirim almaz.
        </Text>
        <Button
          label="Engelle"
          variant="danger"
          block
          onPress={async () => {
            if (!profile) return;
            setConfirmBlock(false);
            try {
              await api.block(profile.id);
              showToast('Engellendi');
              back();
            } catch (e) {
              showToast(errorText(e), 'warning');
            }
          }}
        />
      </BottomSheet>
    </Screen>
  );
}
