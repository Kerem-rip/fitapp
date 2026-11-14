// Görselli kutular: antrenman kartı, bölge kutusu, program kartı ve detay ekranlarının üst görseli.
// Metin okunabilsin diye görselin üstüne koyu katman biner. Görseli olmayan (ör. yüz) kutularda tema renkli yer tutucu görünür.
import { Icon, Text, useTheme } from '@fitapp/ui-mobile';
import { createElement } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { getServerUrl } from '@/api/config';
import { DEMO_IMAGES } from './demoMedia';

export function HeroImage({ hero, height, radius = 24 }: { hero: string; height: number; radius?: number }) {
  const { accent } = useTheme();
  const img = DEMO_IMAGES[hero];
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: img ? '#1B1F2A' : accent }}>
      {img ? (
        <Image source={img} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={hero === 'face' ? 'happy-outline' : 'barbell-outline'} size={Math.min(72, height * 0.4)} color="rgba(255,255,255,0.35)" />
        </View>
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: img ? 'rgba(0,0,0,0.3)' : 'transparent' }} />
    </View>
  );
}

// Hareketin medyası: geçici demo klibi (gif/webp: resim; mp4/webm: web'de video) ya da kapak görseli. Klip yoksa kapak görseli gösterilir.
export function MoveMedia({ media, hero, height, radius = 24 }: { media?: { status: string; kind?: 'video' | 'image'; url?: string } | null; hero: string; height: number; radius?: number }) {
  if (media?.status === 'DEMO' && media.url) {
    const uri = `${getServerUrl().replace(/\/api\/?$/, '')}${media.url}`;
    if (media.kind === 'image') {
      return (
        <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#000' }}>
          <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
        </View>
      );
    }
    if (Platform.OS === 'web') {
      return (
        <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#000' }}>
          {createElement('video', { src: uri, autoPlay: true, loop: true, muted: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover' } })}
        </View>
      );
    }
  }
  return <HeroImage hero={hero} height={height} radius={radius} />;
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

// Bölge kutusu (Göğüs · 42 Hareket): koyu görsel, solda ad ve sayı, sağda ok
export function RegionTile({ hero, title, subtitle, onPress, height = 104 }: { hero: string; title: string; subtitle: string; onPress: () => void; height?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} style={{ marginBottom: 12 }}>
      <HeroImage hero={hero} height={height} radius={20} />
      <View style={{ position: 'absolute', left: 18, right: 18, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ color: '#FFFFFF' }}>
            {title}
          </Text>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {subtitle}
          </Text>
        </View>
        <Icon name="arrow-forward" size={20} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}
