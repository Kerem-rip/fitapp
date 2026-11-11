// Haftalık gün şeridi (Pazartesi–Pazar). Öğesi olan günlerin altında nokta görünür.
import { Text, tap, useTheme } from '@fitapp/ui-mobile';
import { Pressable, View } from 'react-native';
import { dayNumber, DAY_SHORT, weekOf } from '@/demo/dates';

export function WeekStrip({
  selected,
  onSelect,
  marked = [],
}: {
  selected: string;
  onSelect: (key: string) => void;
  marked?: string[];
}) {
  const { c, accentGradient, accent } = useTheme();
  const days = weekOf(selected);
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
      {days.map((key, i) => {
        const active = key === selected;
        return (
          <Pressable
            key={key}
            onPress={() => {
              tap();
              onSelect(key);
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              borderRadius: 18,
              backgroundColor: active ? accent : c.surface,
              borderWidth: 1,
              borderColor: active ? accent : c.border,
            }}
          >
            <Text variant="micro" style={{ color: active ? '#FFFFFF' : c.textSecondary }}>
              {DAY_SHORT[i]}
            </Text>
            <Text variant="heading" style={{ color: active ? '#FFFFFF' : c.text, marginTop: 2 }}>
              {dayNumber(key)}
            </Text>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                marginTop: 4,
                backgroundColor: marked.includes(key) ? (active ? '#FFFFFF' : accentGradient[0]) : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
