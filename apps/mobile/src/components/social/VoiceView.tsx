// Telefon: sesli mesaj kutusu; dokununca telefonun oynatıcısında açılır.
// Not: Uygulama içinde çalma ve ses kaydetme `expo-audio` paketi kurulunca eklenecek (VideoView'daki notla aynı sebep).
import { Icon, Text } from '@fitapp/ui-mobile';
import { Linking, Pressable } from 'react-native';
import { mediaUrl } from '@/api/media';

export function VoiceView({ url, durationMs, light = false }: { url: string; durationMs?: number | null; light?: boolean }) {
  const uri = mediaUrl(url);
  const color = light ? '#FFFFFF' : undefined;
  return (
    <Pressable onPress={() => (uri ? void Linking.openURL(uri) : undefined)} accessibilityRole="button" accessibilityLabel="Sesli mesajı çal" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      <Icon name="play-circle" size={32} color={color} />
      <Text variant="bodyStrong" style={color ? { color } : undefined}>
        Sesli mesaj{durationMs ? ` · ${Math.round(durationMs / 1000)} sn` : ''}
      </Text>
    </Pressable>
  );
}
