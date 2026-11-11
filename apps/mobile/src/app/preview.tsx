// "Başkaları nasıl görür": profilini bir ziyaretçinin gözüyle önizler.
// Kilo, ölçü ve öğün kayıtları hiçbir zaman başkalarına görünmez.
import { Avatar, Button, Card, Notice, Screen, ScreenHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useAccount, useUserData } from '@/demo/hooks';
import { fullName } from '@/demo/selectors';

export default function ProfilePreviewScreen() {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  if (!account) return null;

  return (
    <Screen>
      <ScreenHeader title="Başkaları nasıl görür" subtitle="Ziyaretçi görünümü" onBack={() => router.back()} />

      <Card>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Avatar name={fullName(account)} size={84} story />
          <Text variant="title" style={{ marginTop: 12 }}>
            {fullName(account)}
          </Text>
          <Text variant="caption" tone="secondary">
            @{account.username}
          </Text>
          <Text variant="body" align="center" style={{ marginTop: 10 }}>
            {account.bio || 'Henüz bir tanıtım yazısı yok.'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#8883' }}>
          {[
            ['Takipçi', '18'],
            ['Takip', String(data.following.length)],
            ['Program', String(Object.keys(data.enrollments).length)],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="title">{value}</Text>
              <Text variant="caption" tone="secondary">
                {label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {data.isPrivate ? (
        <>
          <Notice kind="info" title="Gizli hesap" text="Hesabın gizli: yalnızca onayladığın takipçiler paylaştıklarını görür." />
          <Button label="Takip isteği gönder" block size="lg" onPress={() => {}} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Takip et" block size="lg" onPress={() => {}} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Mesaj isteği" variant="ghost" block size="lg" onPress={() => {}} />
          </View>
        </View>
      )}
      <View style={{ marginTop: 12 }}>
        <Tag label="Kilo, ölçü ve öğün kayıtların başkalarına görünmez" kind="success" icon="shield-checkmark" />
      </View>
    </Screen>
  );
}
