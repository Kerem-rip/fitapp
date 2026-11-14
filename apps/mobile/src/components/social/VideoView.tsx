// Telefon: video kutusu; dokununca video telefonun oynatıcısında açılır.
// Not: Uygulama içinde oynatma için `expo-video` paketi kurulunca bu bileşen onunla değiştirilecek
// (bu bilgisayarda paket yöneticisi kurumsal ilkeyle engelli olduğu için kurulamadı).
import { Icon, Text } from '@fitapp/ui-mobile';
import { Linking, Pressable } from 'react-native';
import { mediaUrl } from '@/api/media';

export function VideoView({ url, width, height, durationMs, label }: { url: string; width: number; height: number; durationMs?: number | null; label: string }) {
  const uri = mediaUrl(url);
  return (
    <Pressable
      onPress={() => (uri ? void Linking.openURL(uri) : undefined)}
      accessibilityRole="button"
      accessibilityLabel={`${label}, oynat`}
      style={{ width, height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="play-circle" size={56} color="#FFFFFF" />
      {durationMs ? (
        <Text variant="caption" style={{ color: '#FFFFFF', marginTop: 6 }}>
          {Math.round(durationMs / 1000)} sn
        </Text>
      ) : null}
    </Pressable>
  );
}
