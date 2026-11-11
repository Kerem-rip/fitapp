// Yönetici girişi: normal girişten ayrıdır; yalnızca yönetici ve moderatör hesapları girebilir.
import { Button, Notice, Screen, ScreenHeader, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { adminSignIn, errorText } from '@/auth/actions';

export default function AdminLoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError('Kullanıcı adı ve şifreyi yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminSignIn(identifier, password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Yönetici girişi" subtitle="Yalnızca yetkili hesaplar" onBack={() => router.back()} />
      <Notice kind="info" text="Bu ekran başvuruları incelemek içindir. Normal hesaplar buradan giremez." />
      {error ? <Notice kind="danger" text={error} /> : null}
      <TextField label="Kullanıcı adı veya e-posta" value={identifier} onChangeText={setIdentifier} icon="person-outline" keyboardType="email-address" />
      <TextField label="Şifre" value={password} onChangeText={setPassword} icon="lock-closed-outline" secure onSubmitEditing={submit} />
      <Button label={busy ? 'Giriş yapılıyor...' : 'Giriş yap'} size="lg" block disabled={busy} onPress={submit} />
    </Screen>
  );
}
