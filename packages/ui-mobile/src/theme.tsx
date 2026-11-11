// Tema: açık/koyu mod ve hesap türüne göre vurgu rengi. Tüm parçalar renkleri buradan alır.
import {
  palettes,
  roleThemes,
  type ColorScheme,
  type Palette,
  type RoleTheme,
} from '@fitapp/design-tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  c: Palette;
  role: RoleTheme;
  accent: string;
  accentGradient: readonly [string, string];
  accentSoft: string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  role = 'user',
  preference = 'system',
  children,
}: {
  role?: RoleTheme;
  preference?: ThemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<Theme>(() => {
    const r = roleThemes[role];
    return {
      scheme,
      c: palettes[scheme],
      role,
      accent: r.solid,
      accentGradient: r.gradient,
      accentSoft: r.soft[scheme],
    };
  }, [scheme, role]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme: ThemeProvider bulunamadı');
  return theme;
}
