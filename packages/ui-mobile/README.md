# ui-mobile 🎨

Mobil uygulamanın hazır parçaları. Değerleri `design-tokens`'tan alır; ekranlar sadece bu parçaları kullanır.

| Dosya | Parçalar |
|---|---|
| `theme.tsx` | `ThemeProvider`, `useTheme` (açık/koyu mod + hesap türüne göre vurgu rengi) |
| `primitives.tsx` | `Text`, `Icon`, `Button`, `IconButton`, `Chip`, `Tag`, `Avatar` (hikâye halkası dahil) |
| `layout.tsx` | `Screen`, `ScreenHeader`, `SectionHeader`, `Card`, `Row`, `Spacer` |
| `data.tsx` | `ListRow`, `StatTile`, `ProgressRing`, `ProgressBar`, `BarChart`, `Segmented`, `Notice`, `EmptyState`, `MediaPlaceholder`, `Stars` |
| `form.tsx` | `TextField`, `SearchBar`, `SwitchRow`, `Stepper`, `BottomSheet` |
| `feedback.tsx` | `ToastHost`, `showToast` |
| `tab-bar.tsx` | Alttan yüzen hap şeklinde sekme çubuğu |

Tasarımcı geldiğinde burası ve `design-tokens` değişir; `apps/mobile` içindeki ekranlar değişmez.
