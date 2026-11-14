// Gönderi/yorum metni: #etiket ve @bahsetme dokunulabilir (etiket aramaya, bahsetme profile gider).
import { Text, useTheme, type AppTextProps } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';

const TOKEN = /([#@][\p{L}\p{N}_.]+)/gu;

export function RichText({ text, ...rest }: { text: string } & AppTextProps) {
  const router = useRouter();
  const { c } = useTheme();
  const parts = text.split(TOKEN);
  return (
    <Text {...rest}>
      {parts.map((part, i) => {
        if (i % 2 === 1 && part.length > 1) {
          const value = part.slice(1).replace(/\.+$/, '');
          const go = part.startsWith('#')
            ? () => router.push({ pathname: '/search', params: { tag: value.toLocaleLowerCase('tr') } })
            : () => router.push(`/u/${value.toLowerCase()}`);
          return (
            <Text key={i} variant={rest.variant} onPress={go} style={{ color: c.info, fontWeight: '600' }}>
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
