// Kayıt ol: hesap biçimi seçilir. Hesap türü baştan seçilir, sonradan "doğrulama" yoktur.
import { Card, Icon, Notice, Screen, ScreenHeader, Tag, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

function TypeCard({
  icon,
  title,
  text,
  tag,
  onPress,
}: {
  icon: IconName;
  title: string;
  text: string;
  tag?: string;
  onPress: () => void;
}) {
  const { accent, accentSoft } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={28} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">{title}</Text>
          <Text variant="caption" tone="secondary">
            {text}
          </Text>
          {tag ? <Tag label={tag} kind="neutral" /> : null}
        </View>
        <Icon name="chevron-forward" size={20} />
      </View>
    </Card>
  );
}

export default function RegisterTypeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Kayıt ol" subtitle="Hesap türünü seç" onBack={() => router.back()} />
      <TypeCard
        icon="person"
        title="Standart kullanıcı"
        text="Beslenme ve egzersiz takibi, uzmanlarla iletişim, topluluk. Hemen başla."
        onPress={() => router.push('/register')}
      />
      <TypeCard
        icon="shield-checkmark"
        title="Profesyonel hesap"
        text="Diyetisyen, bağımsız eğitmen veya salon sahibi. Belge ve onay gerekir."
        tag="Onay süreci vardır"
        onPress={() => router.push('/pro-field')}
      />
      <Notice kind="info" text="Her iki hesapta da e-posta adresin doğrulama koduyla onaylanır." />
    </Screen>
  );
}
