// Karşılama ekranı: uygulamanın ilk izlenimi.
import { Avatar, Button, Icon, Text, useTheme } from '@fitapp/ui-mobile';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PILLS = ['Beslenme', 'Egzersiz', 'Uzmanlar', 'Koçluk'];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accentGradient } = useTheme();

  return (
    <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -90, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 140, left: -120, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.08)' }} />

      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="leaf" size={24} color={accentGradient[0]} />
          </View>
          <Text variant="title" tone="onAccent">
            fitapp
          </Text>
        </View>

        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {PILLS.map((pill) => (
              <View key={pill} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' }}>
                <Text variant="caption" tone="onAccent" style={{ fontWeight: '700' }}>
                  {pill}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="display" tone="onAccent" style={{ fontSize: 40, lineHeight: 46 }}>
            Sağlıklı yaşam, senin tempoda.
          </Text>
          <Text variant="subheading" tone="onAccent" style={{ marginTop: 12, opacity: 0.92, fontWeight: '500' }}>
            Beslenmeni takip et, egzersizlerini keşfet, doğrulanmış diyetisyen ve eğitmenlerle tanış.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
            {['Zeynep Arslan', 'Burak Yıldız', 'Aylin Sever', 'Murat Aydın'].map((name, i) => (
              <View key={name} style={{ marginLeft: i === 0 ? 0 : -12, borderRadius: 30, borderWidth: 2.5, borderColor: '#FFFFFF' }}>
                <Avatar name={name} size={40} />
              </View>
            ))}
            <Text variant="caption" tone="onAccent" style={{ marginLeft: 12, fontWeight: '700' }}>
              Uzmanlar seni bekliyor
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Button label="Başla" variant="light" size="lg" block onPress={() => router.push('/onboarding')} />
          <Button label="Zaten hesabım var" variant="glass" size="lg" block onPress={() => router.push('/login')} />
        </View>
      </View>
    </LinearGradient>
  );
}
