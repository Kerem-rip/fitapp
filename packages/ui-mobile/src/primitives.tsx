// Temel parçalar: yazı, ikon, buton, etiket, avatar.
import { Ionicons } from '@expo/vector-icons';
import { radius, typography } from '@fitapp/design-tokens';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import {
  Pressable,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// Dokunma hissi (titreşim). Desteklemeyen yerde sessizce atlanır.
export function tap() {
  try {
    Promise.resolve(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {});
  } catch {
    // titreşim yoksa sorun değil
  }
}

// ───────────── Yazı ─────────────

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'onAccent'
  | 'success'
  | 'warning'
  | 'danger';

export interface AppTextProps extends TextProps {
  variant?: keyof typeof typography;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  const { c, accent } = useTheme();
  const colors: Record<TextTone, string> = {
    primary: c.text,
    secondary: c.textSecondary,
    muted: c.textMuted,
    accent,
    onAccent: '#FFFFFF',
    success: c.success,
    warning: c.warning,
    danger: c.danger,
  };
  const v = typography[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          color: colors[tone],
          fontSize: v.fontSize,
          lineHeight: v.lineHeight,
          fontWeight: v.fontWeight,
          letterSpacing: v.letterSpacing,
        },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

// ───────────── İkon ─────────────

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.text} />;
}

// ───────────── Buton ─────────────

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  // light / glass: renkli (gradyan) zemin üstünde kullanım için
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  block?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  block = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { c, accent, accentGradient } = useTheme();
  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const color =
    variant === 'primary' || variant === 'glass'
      ? '#FFFFFF'
      : variant === 'danger'
        ? c.danger
        : variant === 'secondary'
          ? c.text
          : accent;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height,
        paddingHorizontal: size === 'sm' ? 16 : 22,
      }}
    >
      {icon ? <Ionicons name={icon} size={fontSize + 3} color={color} /> : null}
      <RNText style={{ color, fontSize, fontWeight: '700' }}>{label}</RNText>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        { borderRadius: radius.full, overflow: 'hidden', alignSelf: block ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1 },
        variant === 'secondary' ? { backgroundColor: c.surfaceAlt } : null,
        variant === 'danger' ? { backgroundColor: c.dangerSoft } : null,
        variant === 'ghost' ? { borderWidth: 1, borderColor: c.border } : null,
        variant === 'light' ? { backgroundColor: '#FFFFFF' } : null,
        variant === 'glass' ? { backgroundColor: 'rgba(255,255,255,0.22)' } : null,
        pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  badge,
  size = 44,
  label,
  filled = false,
}: {
  icon: IconName;
  onPress?: () => void;
  badge?: number;
  size?: number;
  label: string;
  filled?: boolean;
}) {
  const { c, accent } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? accent : c.surface,
          borderWidth: filled ? 0 : 1,
          borderColor: c.border,
        },
        pressed ? { opacity: 0.8, transform: [{ scale: 0.96 }] } : null,
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={filled ? '#FFFFFF' : c.text} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: c.danger,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: c.background,
          }}
        >
          <RNText style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</RNText>
        </View>
      ) : null}
    </Pressable>
  );
}

// ───────────── Seçim çipi ve etiket ─────────────

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { c, accent } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: selected ? accent : c.surface,
          borderWidth: 1,
          borderColor: selected ? accent : c.border,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? '#FFFFFF' : c.textSecondary} /> : null}
      <RNText style={{ color: selected ? '#FFFFFF' : c.text, fontSize: 13, fontWeight: '600' }}>{label}</RNText>
    </Pressable>
  );
}

export type TagKind = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

export function Tag({ label, kind = 'neutral', icon }: { label: string; kind?: TagKind; icon?: IconName }) {
  const { c, accent, accentSoft } = useTheme();
  const map: Record<TagKind, { bg: string; fg: string }> = {
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    danger: { bg: c.dangerSoft, fg: c.danger },
    info: { bg: c.infoSoft, fg: c.info },
    neutral: { bg: c.surfaceAlt, fg: c.textSecondary },
    accent: { bg: accentSoft, fg: accent },
  };
  const { bg, fg } = map[kind];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: radius.full,
        backgroundColor: bg,
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <RNText style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</RNText>
    </View>
  );
}

// ───────────── Avatar (hikâye halkası dahil) ─────────────

const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#FF9A8B', '#FF6A88'],
  ['#A18CD1', '#7F7FD5'],
  ['#43C6AC', '#2BA3C9'],
  ['#FDCB6E', '#F0803C'],
  ['#74B9FF', '#6C7BFF'],
  ['#55D6A5', '#1FA971'],
];

export function initialsOf(name: string): string {
  return name
    .replace(/^(Dyt\.|Uzm\.|Dr\.)\s*/i, '')
    .replace(/[^A-Za-zÇĞİÖŞÜçğıöşü ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 9973;
  return h;
}

export function Avatar({
  name,
  size = 44,
  story = false,
  seen = false,
}: {
  name: string;
  size?: number;
  story?: boolean;
  seen?: boolean;
}) {
  const { c, accentGradient } = useTheme();
  const pair = AVATAR_GRADIENTS[hashOf(name) % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0]!;
  const disc = (
    <LinearGradient
      colors={pair}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <RNText style={{ color: '#FFFFFF', fontSize: size * 0.36, fontWeight: '800' }}>{initialsOf(name)}</RNText>
    </LinearGradient>
  );
  if (!story) return disc;
  const ring = size + 10;
  return (
    <LinearGradient
      colors={seen ? [c.border, c.border] : accentGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ width: ring, height: ring, borderRadius: ring / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: ring - 5,
          height: ring - 5,
          borderRadius: (ring - 5) / 2,
          backgroundColor: c.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {disc}
      </View>
    </LinearGradient>
  );
}
