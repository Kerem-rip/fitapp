import { RoleTabs } from '@/components/RoleTabs';

export default function GymManagerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Genel', icon: 'home' },
        { name: 'team', title: 'Ekip', icon: 'people' },
        { name: 'tasks', title: 'Görev', icon: 'checkbox' },
        { name: 'members', title: 'Üye', icon: 'id-card' },
        { name: 'gym', title: 'Salon', icon: 'business' },
      ]}
    />
  );
}
