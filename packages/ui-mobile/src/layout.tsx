// Sayfa iskeleti ve kartlar.
import { maxContentWidth, radius, shadows } from '@fitapp/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Text, tap } from './primitives';
import { useTheme } from './theme';

// Alttan yüzen menünün altında içerik kalmasın diye bırakılan boşluk
export const TAB_BAR_INSET = 112;

export function Screen({
  children,
  scroll = true,
  tabBarInset = false,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  tabBarInset?: boolean;
  padded?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Kaydırılmayan ekranlarda (sohbet gibi) altta daha az boşluk bırakılır
  const bottom = tabBarInset ? TAB_BAR_INSET : insets.bottom + (scroll ? 24 : 8);
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: maxContentWidth,
    paddingHorizontal: padded ? 16 : 0,
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ alignItems: 'center', paddingTop: 8, paddingBottom: bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={inner}>{children}</View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', paddingBottom: bottom }}>
          <View style={[inner, { flex: 1 }]}>{children}</View>
        </View>
      )}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  leading,
  trailing,
  onBack,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, marginBottom: 8 }}>
      {onBack ? <IconButton icon="chevron-back" label="Geri" onPress={onBack} size={40} /> : null}
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={{ flexDirection: 'row', gap: 8 }}>{trailing}</View> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
      <Text variant="heading">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="bodyStrong" tone="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  variant = 'plain',
  onPress,
  style,
  padded = true,
}: {
  children: ReactNode;
  variant?: 'plain' | 'soft' | 'accent' | 'outline';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { c, accentGradient } = useTheme();
  const base: ViewStyle = {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 12,
  };
  const body: ViewStyle = padded ? { padding: 16 } : {};

  const look: ViewStyle =
    variant === 'plain'
      ? { backgroundColor: c.surface, ...shadows.card }
      : variant === 'soft'
        ? { backgroundColor: c.surfaceAlt }
        : variant === 'outline'
          ? { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }
          : {};

  const content =
    variant === 'accent' ? (
      <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={body}>
        {children}
      </LinearGradient>
    ) : (
      <View style={body}>{children}</View>
    );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [base, look, pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[base, look, style]}>{content}</View>;
}

export function Spacer({ size = 12 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Row({
  children,
  gap = 8,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
