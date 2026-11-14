// Antrenman kartının sıralı hareket listesi: sıra numarası, yapılış (set × tekrar/süre) ve hareketler arası dinlenme.
// Hem kart ekranında hem Görevlerim'de aynı görünür; kullanıcı nereden başlayacağını ve ne kadar dinleneceğini görür.
import type { WorkoutCardSection } from '@fitapp/api-client';
import { Text, useTheme } from '@fitapp/ui-mobile';
import { View } from 'react-native';
import { VERIFICATION_TEXT } from '@/features/library/labels';

export function CardSequence({ sections, onItem, compact = false }: { sections: WorkoutCardSection[]; onItem?: (itemId: string) => void; compact?: boolean }) {
  const { c, accent } = useTheme();
  return (
    <View>
      {sections.map((s) => (
        <View key={s.kind} style={{ marginBottom: compact ? 8 : 16 }}>
          <Text variant="micro" tone="muted" style={{ marginBottom: 6 }}>
            {s.title.toLocaleUpperCase('tr')}
            {compact ? '' : ` · ${s.hint}`}
          </Text>
          {s.items.map((i) => (
            <View key={`${i.order}-${i.itemId}`}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 6 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="micro" style={{ color: accent }}>
                    {i.order}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" onPress={onItem ? () => onItem(i.itemId) : undefined}>
                    {i.title}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {i.workText}
                    {i.replacedFrom ? ` · “${i.replacedFrom.title}” yerine` : ''}
                  </Text>
                  {i.verification === 'held' ? (
                    <Text variant="micro" tone="muted">
                      {VERIFICATION_TEXT.held!.label}
                    </Text>
                  ) : null}
                </View>
              </View>
              {i.restAfterSec > 0 ? (
                <Text variant="micro" tone="muted" style={{ marginLeft: 38, marginBottom: 2 }}>
                  ↓ {i.restAfterSec} sn dinlen
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
