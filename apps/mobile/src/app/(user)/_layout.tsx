import { RoleTabs } from '@/components/RoleTabs';

// Sosyal arayüz (herkes için aynı; profesyoneller de "Hesap değiştir" ile buradadır).
// Alt menü: Akış · Kütüphane · Programım · Profil. Mesajlar sağ üstte, diğer her şey sol üstteki ☰ menüde.
export default function SocialLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Akış', icon: 'home' },
        { name: 'library', title: 'Kütüphane', icon: 'albums' },
        { name: 'program', title: 'Programım', icon: 'checkbox' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
