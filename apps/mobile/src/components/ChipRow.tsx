// Seçim çipleri: yatay kayar ya da alt satıra geçer (tek veya çoklu seçim).
import { Chip, type IconName } from '@fitapp/ui-mobile';
import { ScrollView, View } from 'react-native';

export interface ChipOption<T extends string> {
  key: T;
  label: string;
  icon?: IconName;
}

export function ChipRow<T extends string>({
  options,
  selected,
  onToggle,
  wrap = false,
}: {
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onToggle: (key: T) => void;
  // true: alt satıra geçer; false: yatay kayar
  wrap?: boolean;
}) {
  const chips = options.map((o) => (
    <Chip key={o.key} label={o.label} icon={o.icon} selected={selected.includes(o.key)} onPress={() => onToggle(o.key)} />
  ));

  if (wrap) {
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{chips}</View>;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
      style={{ marginHorizontal: -16 }}
    >
      {chips}
    </ScrollView>
  );
}
