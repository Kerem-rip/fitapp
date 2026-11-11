// Her hesap türünün alttan yüzen sekme çubuğu.
import { FloatingTabBar, Icon, type IconName } from '@fitapp/ui-mobile';
import { Tabs } from 'expo-router';

export interface TabDef {
  name: string;
  title: string;
  icon: IconName;
}

export function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Icon name={tab.icon} size={size} color={typeof color === 'string' ? color : undefined} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
