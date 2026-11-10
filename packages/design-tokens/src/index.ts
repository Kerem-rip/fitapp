// Geçici tasarım değerleri. Profesyonel tasarım gelince sadece bu değerler değişir.

export const colors = {
  primary: "#2E7D5B",
  primaryText: "#FFFFFF",
  background: "#FFFFFF",
  surface: "#F5F7F6",
  text: "#1A1F1C",
  textMuted: "#5F6B65",
  border: "#DDE3E0",
  danger: "#C62828",
  success: "#2E7D32",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, full: 999 } as const;

export const typography = {
  fontFamily: "System",
  sizes: { sm: 13, md: 16, lg: 20, xl: 28 },
  weights: { regular: "400", bold: "700" },
} as const;
