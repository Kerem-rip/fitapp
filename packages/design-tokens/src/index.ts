// Tasarımın tek kaynağı: renkler, yazı tipleri, boşluklar, köşe yuvarlaklıkları.
// Profesyonel tasarım geldiğinde değişecek yer burasıdır; ekranlara dokunulmaz.

export type ColorScheme = 'light' | 'dark';

// Her hesap türünün kendi vurgu rengi vardır, böylece hangi panelde olunduğu hemen anlaşılır
export type RoleTheme = 'user' | 'teen' | 'dietitian' | 'trainer' | 'gymManager' | 'gymStaff' | 'admin';

// SocialFit tasarım sistemi: Ana Yeşil #244A3B, Açık Zemin #F5F2EA, Toprak #B58B68, Koyu #202724
const light = {
  background: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEAE0',
  text: '#202724',
  textSecondary: '#59625C',
  textMuted: '#8B928C',
  border: '#E3DED1',
  overlay: 'rgba(32,39,36,0.45)',
  success: '#2F7D5B',
  successSoft: '#DDEEE4',
  warning: '#B8832A',
  warningSoft: '#F6EAD2',
  danger: '#C8473D',
  dangerSoft: '#F7E0DD',
  info: '#3C6E91',
  infoSoft: '#DCE8F0',
  // Toprak: Premium etiketi ve ikincil vurgu
  earth: '#B58B68',
  earthSoft: '#F1E6DB',
};

const dark: typeof light = {
  background: '#121614',
  surface: '#1B211E',
  surfaceAlt: '#252C28',
  text: '#F2F0EA',
  textSecondary: '#A9B0AA',
  textMuted: '#78807A',
  border: '#2B332E',
  overlay: 'rgba(0,0,0,0.6)',
  success: '#4CB88A',
  successSoft: '#17342A',
  warning: '#E0A94A',
  warningSoft: '#3A2E15',
  danger: '#E8776E',
  dangerSoft: '#40201D',
  info: '#6FA6CA',
  infoSoft: '#1B3140',
  earth: '#C99F7C',
  earthSoft: '#3B2E24',
};

export const palettes = { light, dark } as const;
export type Palette = Record<keyof typeof light, string>;

export interface RoleThemeColors {
  gradient: readonly [string, string];
  solid: string;
  soft: { light: string; dark: string };
}

export const roleThemes: Record<RoleTheme, RoleThemeColors> = {
  user: { gradient: ['#244A3B', '#2C5845'], solid: '#244A3B', soft: { light: '#E1ECE5', dark: '#1D3A2D' } },
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
  card: { shadowColor: '#202724', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  float: { shadowColor: '#202724', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
} as const;

// Tabletlerde içerik bu genişliği geçmez, ortada durur
export const maxContentWidth = 680;
