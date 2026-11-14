// Kişi fotoğrafı: fotoğraf varsa onu, yoksa ad baş harfli renkli daireyi gösterir.
import { Avatar, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { mediaUrl } from '@/api/media';

export function UserAvatar({ name, url, size = 44 }: { name: string; url: string | null | undefined; size?: number }) {
  const { c } = useTheme();
  const uri = mediaUrl(url);
  if (!uri) return <Avatar name={name} size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={`${name} profil fotoğrafı`} />
    </View>
  );
}
