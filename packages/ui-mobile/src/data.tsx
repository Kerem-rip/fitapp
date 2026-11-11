// Veri gösteren parçalar: liste satırı, sayaç, halka, grafik, uyarı.
import { radius } from '@fitapp/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useId, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Card } from './layout';
import { Avatar, Icon, Text, tap, type IconName } from './primitives';
import { useTheme } from './theme';

export function ListRow({
  icon,
  avatar,
  title,
  subtitle,
  trailing,
  onPress,
  last = false,
}: {
  icon?: IconName;
  avatar?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const { c, accent, accentSoft } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      {avatar ? (
        <Avatar name={avatar} size={42} />
      ) : icon ? (
        <View
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={icon} size={20} color={accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={18} color={c.textMuted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      {content}
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
}) {
  const { accent } = useTheme();
  return (
    <Card style={{ flex: 1, marginBottom: 0 }}>
      {icon ? <Icon name={icon} size={20} color={accent} /> : null}
      <Text variant="title" style={{ marginTop: icon ? 8 : 0 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text variant="micro" tone="muted" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

export function ProgressRing({
  value,
  goal,
  size = 132,
  stroke = 13,
  children,
  light = false,
}: {
  value: number;
  goal: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  // Gradyan zemin üstünde kullanım için beyaz halka
  light?: boolean;
}) {
  const { c, accentGradient } = useTheme();
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accentGradient[0]} />
            <Stop offset="1" stopColor={accentGradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={light ? 'rgba(255,255,255,0.28)' : c.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={light ? '#FFFFFF' : `url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ value, max, height = 8 }: { value: number; max: number; height?: number }) {
  const { c, accentGradient } = useTheme();
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <LinearGradient
        colors={accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct * 100}%`, height, borderRadius: height / 2 }}
      />
    </View>
  );
}

export function BarChart({
  values,
  labels,
  height = 96,
  format,
}: {
  values: number[];
  labels: string[];
  height?: number;
  format?: (v: number) => string;
}) {
  const { accent, accentSoft } = useTheme();
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || 1;
  const last = values.length - 1;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
        {values.map((v, i) => {
          const h = 18 + ((v - min) / span) * (height - 34);
          return (
            <View key={`${labels[i]}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {i === last && format ? (
                <Text variant="micro" tone="accent" style={{ marginBottom: 2 }}>
                  {format(v)}
                </Text>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 10,
                  backgroundColor: i === last ? accent : accentSoft,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text key={`${l}-${i}`} variant="micro" tone="muted" align="center" style={{ flex: 1 }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { c, accent } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.full, padding: 4, marginBottom: 12 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={{
              flex: 1,
              height: 36,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.surface : 'transparent',
            }}
          >
            <Text variant="caption" style={{ fontWeight: '700', color: active ? accent : c.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Notice({
  kind = 'info',
  text,
  title,
}: {
  kind?: 'info' | 'warning' | 'success' | 'danger';
  text: string;
  title?: string;
}) {
  const { c } = useTheme();
  const map = {
    info: { bg: c.infoSoft, fg: c.info, icon: 'information-circle' as IconName },
    warning: { bg: c.warningSoft, fg: c.warning, icon: 'alert-circle' as IconName },
    success: { bg: c.successSoft, fg: c.success, icon: 'shield-checkmark' as IconName },
    danger: { bg: c.dangerSoft, fg: c.danger, icon: 'warning' as IconName },
  }[kind];
  return (
    <View
      style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: map.bg, marginBottom: 12 }}
    >
      <Icon name={map.icon} size={20} color={map.fg} />
      <View style={{ flex: 1 }}>
        {title ? (
          <Text variant="bodyStrong" style={{ color: map.fg }}>
            {title}
          </Text>
        ) : null}
        <Text variant="caption" style={{ color: c.text, lineHeight: 18 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
      <Icon name={icon} size={40} color={c.textMuted} />
      <Text variant="subheading">{title}</Text>
      {text ? (
        <Text variant="caption" tone="secondary" align="center">
          {text}
        </Text>
      ) : null}
    </View>
  );
}

// Henüz içeriği olmayan alan (ör. video, kas haritası) için kesik çizgili kutu
export function MediaPlaceholder({ icon, label, height = 160 }: { icon: IconName; label: string; height?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.border,
        backgroundColor: c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
      }}
    >
      <Icon name={icon} size={32} color={c.textMuted} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

export function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={6}>
          <Icon name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? '#F5A524' : c.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}
