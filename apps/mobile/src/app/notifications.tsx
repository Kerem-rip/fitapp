// Bildirimler: iki ayrı merkez. "Sosyal" (takip, beğeni, yorum, bahsetme, hikâye) ve
// "Uzman ve sağlık" (randevu, plan, danışanlık, salon). Biri diğerinin içine karışmaz.
// Demo sürümde örnek veriden gelen bildirimler "Uzman ve sağlık" altında ayrıca gösterilir.
import type { AppNotificationItem, NotificationCenter } from '@fitapp/api-client';
import { Card, EmptyState, IconButton, ListRow, Notice, Screen, ScreenHeader, SectionHeader, Tag, type IconName } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { DEMO_TOOLS } from '@/config/features';
import { markNotificationsRead } from '@/demo/actions';
import { timeAgo } from '@/demo/dates';
import { useAccount, useShared, useSurface } from '@/demo/hooks';

function iconOf(type: string): IconName {
  if (type.startsWith('social_follow')) return 'person-add-outline';
  if (type === 'social_like') return 'heart-outline';
  if (type === 'social_comment' || type === 'social_reply') return 'chatbubble-outline';
  if (type.includes('mention')) return 'at-outline';
  if (type.startsWith('social_story')) return 'aperture-outline';
  if (type.startsWith('moderation') || type.startsWith('appeal')) return 'shield-outline';
  return 'notifications-outline';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const surface = useSurface();
  const [center, setCenter] = useState<NotificationCenter>(surface === 'pro' ? 'PRO' : 'SOCIAL');
  const [items, setItems] = useState<AppNotificationItem[] | null>(null);
  const [counts, setCounts] = useState({ social: 0, pro: 0 });
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      Promise.all([api.notifications(50, center), api.notificationCounts()])
        .then(([res, c]) => {
          setItems(res.items);
          setCounts(c);
          setError(null);
          // Ekran açılınca bu merkezdekiler görülmüş sayılır; bu açılışta yeni olanlar etiketli kalır
          if (res.unread > 0) timer = setTimeout(() => void api.markNotificationsRead(undefined, center).catch(() => {}), 1200);
        })
        .catch((e) => setError(errorText(e)));
      return () => clearTimeout(timer);
    }, [center]),
  );

  const demo = useMemo(
    () => (DEMO_TOOLS && center === 'PRO' ? shared.notifications.filter((n) => n.toAccountId === account?.id).sort((a, b) => b.at.localeCompare(a.at)) : []),
    [shared.notifications, account?.id, center],
  );
  const demoUnread = demo.some((n) => !n.read);
  useEffect(() => {
    if (!account || !demoUnread) return;
    const timer = setTimeout(() => markNotificationsRead(account.id), 1200);
    return () => clearTimeout(timer);
  }, [account, demoUnread]);

  // Sosyal bildirime dokununca ilgili yere gidilir
  const open = (n: AppNotificationItem) => {
    if (n.type === 'social_follow_request') router.push('/follow-requests');
    else if (n.postId) router.push(`/post/${n.postId}`);
    else if (n.type === 'moderation_removed') router.push('/moderation-notices');
    else if (n.actorUsername) router.push(`/u/${n.actorUsername}`);
  };
  const tappable = (n: AppNotificationItem) => n.center === 'SOCIAL' && (n.postId !== null || n.actorUsername !== null || n.type === 'moderation_removed');

  const empty = items !== null && items.length === 0 && demo.length === 0;

  return (
    <Screen>
      <ScreenHeader
        title="Bildirimler"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        trailing={<IconButton icon="settings-outline" label="Bildirim ayarları" onPress={() => router.push('/notification-settings')} />}
      />
      <ChipRow
        options={[
          { key: 'SOCIAL' as const, label: counts.social ? `Sosyal (${counts.social})` : 'Sosyal' },
          { key: 'PRO' as const, label: counts.pro ? `Uzman ve sağlık (${counts.pro})` : 'Uzman ve sağlık' },
        ]}
        selected={[center]}
        onToggle={(c) => {
          setItems(null);
          setCenter(c);
        }}
      />
      <View style={{ height: 12 }} />
      {error ? <Notice kind="warning" text={error} /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((n, i) => (
            <ListRow
              key={n.id}
              icon={iconOf(n.type)}
              title={n.title}
              subtitle={`${n.text ? `${n.text} · ` : ''}${timeAgo(n.createdAt)}`}
              trailing={!n.read ? <Tag label="Yeni" kind="accent" /> : undefined}
              onPress={tappable(n) ? () => open(n) : undefined}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {demo.length > 0 ? (
        <>
          <SectionHeader title="Demo bildirimleri" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {demo.map((n, i) => (
              <ListRow
                key={n.id}
                icon="notifications-outline"
                title={n.title}
                subtitle={`${n.text} · ${timeAgo(n.at)}`}
                trailing={!n.read ? <Tag label="Yeni" kind="accent" /> : undefined}
                last={i === demo.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
      {empty ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Bildirimin yok"
          text={center === 'SOCIAL' ? 'Takip, beğeni, yorum ve bahsetmeler burada görünür.' : 'Randevu, plan ve danışanlık gelişmeleri burada görünür.'}
        />
      ) : null}
    </Screen>
  );
}
