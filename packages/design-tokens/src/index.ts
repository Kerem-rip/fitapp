// Tasarımın tek kaynağı: renkler, yazı tipleri, boşluklar, köşe yuvarlaklıkları.
// Profesyonel tasarım geldiğinde değişecek yer burasıdır; ekranlara dokunulmaz.

export type ColorScheme = 'light' | 'dark';

// Her hesap türünün kendi vurgu rengi vardır, böylece hangi panelde olunduğu hemen anlaşılır
export type RoleTheme = 'user' | 'teen' | 'dietitian' | 'trainer' | 'gymManager' | 'gymStaff' | 'admin';

const light = {
  background: '#F4F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF6',
  text: '#0F1218',
  textSecondary: '#586172',
  textMuted: '#8A93A3',
  border: '#E2E5EE',
  overlay: 'rgba(15,18,24,0.45)',
  success: '#12B76A',
  successSoft: '#DCFAE9',
  warning: '#F79009',
  warningSoft: '#FEF0C7',
  danger: '#F04438',
  dangerSoft: '#FEE4E2',
  info: '#2E90FA',
  infoSoft: '#D1E9FF',
};

const dark: typeof light = {
  background: '#0B0D12',
  surface: '#151921',
  surfaceAlt: '#1E232D',
  text: '#F3F5F9',
  textSecondary: '#A0A9BA',
  textMuted: '#6F7889',
  border: '#262C38',
  overlay: 'rgba(0,0,0,0.6)',
  success: '#32D583',
  successSoft: '#12372A',
  warning: '#FDB022',
  warningSoft: '#3D2E10',
  danger: '#F97066',
  dangerSoft: '#40191A',
  info: '#53B1FD',
  infoSoft: '#12304F',
};

export const palettes = { light, dark } as const;
export type Palette = Record<keyof typeof light, string>;

export interface RoleThemeColors {
  gradient: readonly [string, string];
  solid: string;
  soft: { light: string; dark: string };
}

export const roleThemes: Record<RoleTheme, RoleThemeColors> = {
  user: { gradient: ['#10C98F', '#18A0FB'], solid: '#0FB67F', soft: { light: '#DDF7EE', dark: '#0F3A2D' } },
  teen: { gradient: ['#FF5FA2', '#8E6BFF'], solid: '#E8498F', soft: { light: '#FFE3EF', dark: '#431A30' } },
  dietitian: { gradient: ['#7C5CFF', '#4F8BFF'], solid: '#6B4EF0', soft: { light: '#E9E3FF', dark: '#2B2252' } },
  trainer: { gradient: ['#FF7A45', '#FF3D77'], solid: '#F2562F', soft: { light: '#FFE6DC', dark: '#4A2216' } },
  gymManager: { gradient: ['#2F6BFF', '#7A4DFF'], solid: '#3A63F0', soft: { light: '#DFE8FF', dark: '#1B2754' } },
  gymStaff: { gradient: ['#FFB020', '#FF6B3D'], solid: '#F59A0B', soft: { light: '#FFEFCF', dark: '#473010' } },
  admin: { gradient: ['#475569', '#1E293B'], solid: '#334155', soft: { light: '#E2E8F0', dark: '#1E293B' } },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, full: 999 } as const;

export interface TextVariant {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
}

export const typography: Record<
  'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyStrong' | 'caption' | 'micro',
  TextVariant
> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
};

// Yumuşak gölgeler (iOS gölge özellikleri + Android elevation)
export const shadows = {
  card: { shadowColor: '#0F1218', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  float: { shadowColor: '#0F1218', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const;

// Tabletlerde içerik bu genişliği geçmez, ortada durur
export const maxContentWidth = 680;
