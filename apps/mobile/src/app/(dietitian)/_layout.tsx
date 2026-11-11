import { RoleTabs } from '@/components/RoleTabs';

export default function DietitianLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Panel', icon: 'home' },
        { name: 'clients', title: 'Danışan', icon: 'people' },
        { name: 'agenda', title: 'Ajanda', icon: 'calendar' },
        { name: 'messages', title: 'Mesaj', icon: 'chatbubbles' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
