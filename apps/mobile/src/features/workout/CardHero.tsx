// Büyük görselli antrenman kartı (liste) ve detay ekranının üst görseli. Metin okunabilsin diye görselin üstüne koyu katman biner.
import { Text } from '@fitapp/ui-mobile';
import { Image, Pressable, View } from 'react-native';
import { DEMO_IMAGES } from './demoMedia';

export function HeroImage({ hero, height, radius = 24 }: { hero: string; height: number; radius?: number }) {
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#1B1F2A' }}>
      {DEMO_IMAGES[hero] ? <Image source={DEMO_IMAGES[hero]} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors /> : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.28)' }} />
    </View>
  );
}

// Liste kartı: görsel, solda başlık ve egzersiz sayısı, sağda süre
export function CardTile({ hero, title, moves, minutes, onPress }: { hero: string; title: string; moves: number; minutes: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${moves} egzersiz, ${minutes} dakika`} style={{ marginBottom: 14 }}>
      <HeroImage hero={hero} height={190} />
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text variant="heading" style={{ color: '#FFFFFF' }}>
            {title}
          </Text>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {moves} Egzersiz
          </Text>
        </View>
        <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
          {minutes} dk
        </Text>
      </View>
    </Pressable>
  );
}
