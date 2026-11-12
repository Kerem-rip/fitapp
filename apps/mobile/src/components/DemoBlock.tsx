// Örnek (demo) içerik kutusu. Sadece demo araçları açıkken görünür ve "örnek" diye açıkça etiketlenir;
// yayın derlemesinde hiç görünmez. Gerçek kişiler ya da gerçek veri gibi sunulan sahte içerik bu kutunun dışında gösterilmez.
import { Card, Text, useTheme } from '@fitapp/ui-mobile';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { DEMO_TOOLS } from '@/config/features';

export function DemoBlock({ children, note = 'Aşağıdakiler örnek içeriktir; gerçek kişi ya da gerçek veri değildir. Yayın sürümünde görünmez.' }: { children: ReactNode; note?: string }) {
  const { c } = useTheme();
  if (!DEMO_TOOLS) return null;
  return (
    <View style={{ marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.border }}>
      <Card variant="outline" style={{ marginBottom: 10 }}>
        <Text variant="micro" tone="secondary" style={{ fontWeight: '700' }}>
          ÖRNEK İÇERİK (DEMO)
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {note}
        </Text>
      </Card>
      {children}
    </View>
  );
}
