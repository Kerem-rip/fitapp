// Sosyal arayüzün ☰ menüsü: bildirimler, sağlık kayıtları, uzmanlarım, ayarlar ve (profesyonelde) panele geçiş.
// Alt menüde olmayan her şey buradan açılır. Hiçbir madde otomatik açılmaz; kullanıcı isterse girer.
import { BottomSheet, ListRow, SectionHeader } from '@fitapp/ui-mobile';
import { useRouter, type Href } from 'expo-router';
import { signOut } from '@/auth/actions';
import { setSurface } from '@/demo/actions';
import { isProRole, useAccount } from '@/demo/hooks';

export function SocialMenu({ visible, onClose, unread }: { visible: boolean; onClose: () => void; unread: number }) {
  const router = useRouter();
  const account = useAccount();
  if (!account) return null;
  const pro = isProRole(account.roleKey);

  const go = (path: Href) => {
    onClose();
    router.push(path);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Menü">
      <ListRow icon="notifications-outline" title="Bildirimler" subtitle={unread > 0 ? `${unread} okunmamış` : undefined} onPress={() => go('/notifications')} />
      <ListRow icon="bookmark-outline" title="Kaydedilenler" onPress={() => go('/saved')} />
      <ListRow icon="archive-outline" title="Hikâye arşivi" onPress={() => go('/story-archive')} />
      <ListRow icon="star-outline" title="Yakın arkadaşlar" onPress={() => go('/close-friends')} last />

      <SectionHeader title="Sağlığım" />
      <ListRow icon="today-outline" title="Bugün" subtitle="Kalori, su ve kilo özeti" onPress={() => go('/today')} />
      <ListRow icon="restaurant-outline" title="Öğün ve su kaydı" subtitle="Beslenme günlüğün" onPress={() => go('/nutrition')} />
      <ListRow icon="clipboard-outline" title="Ölçümlerim ve sağlık öyküm" onPress={() => go('/my-health')} last />

      <SectionHeader title="Uzmanlarım" />
      <ListRow icon="calendar-outline" title="Randevularım ve hedeflerim" onPress={() => go('/my-appointments')} />
      <ListRow icon="shield-checkmark-outline" title="Paylaşım ve erişim" subtitle="Uzmanlara ne paylaştığın" onPress={() => go('/sharing')} />
      <ListRow icon="business-outline" title="Salon davetlerim" onPress={() => go('/gym-invites')} last />

      <SectionHeader title="Hesap" />
      <ListRow icon="settings-outline" title="Ayarlar ve gizlilik" onPress={() => go('/settings')} />
      <ListRow icon="notifications-circle-outline" title="Bildirim ayarları" onPress={() => go('/notification-settings')} />
      {pro ? (
        <ListRow
          icon="swap-horizontal-outline"
          title="Profesyonel panele geç"
          subtitle="Danışanların ve mesleki araçların"
          onPress={() => {
            onClose();
            setSurface(account.id, 'pro');
            router.replace('/');
          }}
        />
      ) : null}
      <ListRow
        icon="log-out-outline"
        title="Çıkış yap"
        subtitle={`@${account.username}`}
        onPress={() => {
          onClose();
          void signOut();
        }}
        last
      />
    </BottomSheet>
  );
}
