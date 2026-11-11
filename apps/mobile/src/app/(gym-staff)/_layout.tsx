import { RoleTabs } from '@/components/RoleTabs';

// Salona bağlı eğitmen / personel
export default function GymStaffLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Bugün', icon: 'home' },
        { name: 'tasks', title: 'Görev', icon: 'checkbox' },
        { name: 'clients', title: 'Danışan', icon: 'people' },
        { name: 'lessons', title: 'Ders', icon: 'calendar' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
