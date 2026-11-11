import { RoleTabs } from '@/components/RoleTabs';

// Bireysel ve genç kullanıcı
export default function UserLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Bugün', icon: 'home' },
        { name: 'nutrition', title: 'Beslenme', icon: 'restaurant' },
        { name: 'exercises', title: 'Egzersiz', icon: 'barbell' },
        { name: 'discover', title: 'Keşfet', icon: 'compass' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
