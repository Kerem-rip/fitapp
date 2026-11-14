import { RoleTabs } from '@/components/RoleTabs';

// Sosyal arayüz (herkes için aynı; profesyoneller de "Hesap değiştir" ile buradadır).
// Alt menü: Ana Sayfa · Akış · Kütüphane · Programım · Profil. Mesajlar akışın sağ üstünde, diğer her şey sol üstteki ☰ menüde.
export default function SocialLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Ana Sayfa', icon: 'home' },
        { name: 'feed', title: 'Akış', icon: 'newspaper' },
        { name: 'library', title: 'Kütüphane', icon: 'albums' },
        { name: 'program', title: 'Programım', icon: 'checkbox' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
