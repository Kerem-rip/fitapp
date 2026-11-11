// Alttan yüzen, hap şeklinde menü. Seçili sekme gradyanla ve yazıyla öne çıkar.
import { shadows } from '@fitapp/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { c, accentGradient } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, alignItems: 'center' }}>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            width: '92%',
            maxWidth: 520,
            padding: 6,
            borderRadius: 999,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          },
          shadows.float,
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key] ?? { options: {} };
          // href: null olan (gizli) rotalar menüde gösterilmez
          if (options.href === null) return null;
          const focused = state.index === index;
          const color = focused ? '#FFFFFF' : c.textSecondary;
          const onPress = () => {
            tap();
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }) as {
              defaultPrevented?: boolean;
            };
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const inner = (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, paddingHorizontal: focused ? 14 : 0 }}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              {focused ? (
                <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }} numberOfLines={1}>
                  {options.title ?? route.name}
                </Text>
              ) : null}
            </View>
          );
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={options.title ?? route.name}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={{ flex: focused ? 2.2 : 1, borderRadius: 999, overflow: 'hidden' }}
            >
              {focused ? (
                <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 999 }}>
                  {inner}
                </LinearGradient>
              ) : (
                inner
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
