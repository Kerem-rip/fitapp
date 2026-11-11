import { RoleTabs } from '@/components/RoleTabs';

// Bağımsız eğitmen: salona bağlı olmadan kendi danışanlarını yönetir
export default function TrainerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Panel', icon: 'home' },
        { name: 'clients', title: 'Danışan', icon: 'people' },
        { name: 'programs', title: 'Program', icon: 'list' },
        { name: 'agenda', title: 'Ajanda', icon: 'calendar' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
