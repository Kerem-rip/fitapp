// Bildirimler: yeni plan, görev, danışan bağlantısı gibi olaylar.
import { Card, EmptyState, ListRow, Screen, ScreenHeader, Tag } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { markNotificationsRead } from '@/demo/actions';
import { timeAgo } from '@/demo/dates';
import { useAccount, useShared } from '@/demo/hooks';

export default function NotificationsScreen() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();

  const list = useMemo(
    () => shared.notifications.filter((n) => n.toAccountId === account?.id).sort((a, b) => b.at.localeCompare(a.at)),
    [shared.notifications, account?.id],
  );
  const hasUnread = list.some((n) => !n.read);

  // Ekran açılınca görülmüş sayılır (rozet kaybolur); bu açılışta yeni olanlar etiketli kalır
  useEffect(() => {
    if (!account || !hasUnread) return;
    const timer = setTimeout(() => markNotificationsRead(account.id), 1200);
    return () => clearTimeout(timer);
  }, [account, hasUnread]);

  return (
    <Screen>
      <ScreenHeader title="Bildirimler" onBack={() => router.back()} />
      {list.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {list.map((n, i) => (
            <ListRow
              key={n.id}
              icon="notifications-outline"
              title={n.title}
              subtitle={`${n.text} · ${timeAgo(n.at)}`}
              trailing={!n.read ? <Tag label="Yeni" kind="accent" /> : undefined}
              last={i === list.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="notifications-off-outline" title="Bildirimin yok" text="Yeni gelişmeler burada görünecek." />
      )}
    </Screen>
  );
}
