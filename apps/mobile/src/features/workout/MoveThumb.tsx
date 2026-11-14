// Hareket satırındaki küçük resim: video/çizim gelene kadar çalışan bölgeye göre renkli ikon karesi (geçici).
import { Icon, useTheme, type IconName } from '@fitapp/ui-mobile';
import { View } from 'react-native';

const ICONS: [RegExp, IconName][] = [
  [/nefes|diyafram/i, 'leaf-outline'],
  [/kalça|bacak|baldır/i, 'walk-outline'],
  [/göğüs|omuz|kol|sırt|biceps|triceps/i, 'barbell-outline'],
  [/karın|core|bel/i, 'fitness-outline'],
  [/kalp|dolaşım/i, 'heart-outline'],
];

export function MoveThumb({ primary, size = 52 }: { primary: string[]; size?: number }) {
  const { c, accent } = useTheme();
  const icon = ICONS.find(([re]) => re.test(primary.join(' ')))?.[1] ?? 'body-outline';
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={accent} />
    </View>
  );
}
