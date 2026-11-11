// Bildirimler: randevu, hatırlatma, plan, danışanlık gibi olaylar (sunucudan).
// Demo sürümde örnek veriden gelen bildirimler ayrıca altta gösterilir.
import type { AppNotificationItem } from '@fitapp/api-client';
import { Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SectionHeader, Tag } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { DEMO_TOOLS } from '@/config/features';
import { markNotificationsRead } from '@/demo/actions';
import { timeAgo } from '@/demo/dates';
import { useAccount, useShared } from '@/demo/hooks';

export default function NotificationsScreen() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const [items, setItems] = useState<AppNotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      api
        .notifications()
        .then((res) => {
          setItems(res.items);
          setError(null);
          // Ekran açılınca görülmüş sayılır; bu açılışta yeni olanlar etiketli kalır
          if (res.unread > 0) timer = setTimeout(() => void api.markNotificationsRead().catch(() => {}), 1200);
        })
        .catch((e) => setError(errorText(e)));
      return () => clearTimeout(timer);
    }, []),
  );

  const demo = useMemo(
    () => (DEMO_TOOLS ? shared.notifications.filter((n) => n.toAccountId === account?.id).sort((a, b) => b.at.localeCompare(a.at)) : []),
    [shared.notifications, account?.id],
  );
  const demoUnread = demo.some((n) => !n.read);
  useEffect(() => {
    if (!account || !demoUnread) return;
    const timer = setTimeout(() => markNotificationsRead(account.id), 1200);
    return () => clearTimeout(timer);
  }, [account, demoUnread]);

  const empty = items !== null && items.length === 0 && demo.length === 0;

  return (
    <Screen>
      <ScreenHeader title="Bildirimler" onBack={() => router.back()} />
      {error ? <Notice kind="warning" text={error} /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((n, i) => (
            <ListRow
              key={n.id}
              icon="notifications-outline"
              title={n.title}
              subtitle={`${n.text ? `${n.text} · ` : ''}${timeAgo(n.createdAt)}`}
              trailing={!n.read ? <Tag label="Yeni" kind="accent" /> : undefined}
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
      {empty ? <EmptyState icon="notifications-off-outline" title="Bildirimin yok" text="Yeni gelişmeler burada görünecek." /> : null}
    </Screen>
  );
}
