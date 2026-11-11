// Standart kayıt. Kayıt öncesi başka soru yoktur; profil sonra istenirse tamamlanır.
import { Screen, ScreenHeader } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { RegisterForm } from '@/components/RegisterForm';

export default function RegisterScreen() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Hesap oluştur" subtitle="Birkaç bilgi yeterli" onBack={() => router.back()} />
      <RegisterForm />
    </Screen>
  );
}
