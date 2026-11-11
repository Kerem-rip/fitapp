// Profesyonel kayıt: önce alan seçilir; ilgili kayıt formu ona göre açılır.
import { Card, Icon, Notice, Screen, ScreenHeader, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

const FIELDS: { field: 'DIETITIAN' | 'TRAINER' | 'GYM_OWNER'; icon: IconName; title: string; text: string }[] = [
  { field: 'DIETITIAN', icon: 'restaurant', title: 'Diyetisyen', text: 'Diploma gerekir.' },
  { field: 'TRAINER', icon: 'barbell', title: 'Bağımsız eğitmen', text: 'Antrenörlük belgesi veya diploma gerekir.' },
  { field: 'GYM_OWNER', icon: 'business', title: 'Spor salonu sahibi', text: 'İşletme belgesi (vergi levhası veya ruhsat) gerekir.' },
];

export default function ProFieldScreen() {
  const router = useRouter();
  const { accent, accentSoft } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Alanınızı seçin" subtitle="Profesyonel hesap" onBack={() => router.back()} />
      {FIELDS.map((f) => (
        <Card key={f.field} onPress={() => router.push({ pathname: '/pro-register', params: { field: f.field } })}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={f.icon} size={28} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="heading">{f.title}</Text>
              <Text variant="caption" tone="secondary">
                {f.text}
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} />
          </View>
        </Card>
      ))}
      <Notice kind="info" text="Bir salonda çalışan eğitmenler hesabı kendileri açmaz: salon sahibinin daveti ile katılırlar." />
    </Screen>
  );
}
