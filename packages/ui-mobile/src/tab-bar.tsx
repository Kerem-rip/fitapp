// Alt sekme çubuğu: sade, tam genişlikte; her sekmede ikon ve kısa ad, seçili olan ana yeşil.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, tap } from './primitives';
import { useTheme } from './theme';

// expo-router'ın sekme çubuğu özelliklerinin bu parçanın kullandığı kısmı
export interface FloatingTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
        tabBarBadge?: string | number;
        href?: unknown;
      };
    }
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emitter: { emit: (options: any) => unknown };
  navigateToTab: (routeKey: string) => void;
}

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: FloatingTabBarProps) {
  const { c, accent } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key] ?? { options: {} };
        // href: null olan (gizli) rotalar menüde gösterilmez
        if (options.href === null) return null;
        const focused = state.index === index;
        const color = focused ? accent : c.textMuted;
        const onPress = () => {
          tap();
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }) as { defaultPrevented?: boolean };
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={options.title ?? route.name}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 }}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            <Text variant="micro" style={{ color, fontWeight: focused ? '700' : '500' }} numberOfLines={1}>
              {options.title ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
