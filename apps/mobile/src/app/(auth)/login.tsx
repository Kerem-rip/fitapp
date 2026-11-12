// Giriş. Demo sürümde hazır test hesaplarına tek dokunuşla girilebilir (sunucuda gerçek hesaplardır).
import { Button, Card, Icon, ListRow, Notice, Screen, ScreenHeader, showToast, Tag, Text, TextField, useTheme } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { errorText, signIn } from '@/auth/actions';
import { DEMO_TOOLS } from '@/config/features';
import { ROLE_LABELS } from '@/demo/labels';
import { fullName } from '@/demo/selectors';
import { DEMO_PASSWORD, SEED_ACCOUNTS } from '@/demo/seed';

export default function LoginScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const submit = async (id: string, pw: string) => {
    if (busy) return;
    if (!id.trim() || !pw) {
      setError('E-posta veya kullanıcı adını ve şifreni yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(id, pw);
      if (result.deletionCancelled) showToast('Hesap silme talebin iptal edildi. Tekrar hoş geldin!', 'info');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Giriş yap" subtitle="Tekrar hoş geldin" onBack={() => router.back()} />

      {error ? <Notice kind="danger" text={error} /> : null}

      <TextField
        label="E-posta veya kullanıcı adı"
        value={identifier}
        onChangeText={setIdentifier}
        icon="person-outline"
        keyboardType="email-address"
      />
      <TextField
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        icon="lock-closed-outline"
        secure
        onSubmitEditing={() => submit(identifier, password)}
      />
      <Button label={busy ? 'Giriş yapılıyor...' : 'Giriş yap'} size="lg" block disabled={busy} onPress={() => submit(identifier, password)} />
      <Pressable onPress={() => router.push('/forgot')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text variant="bodyStrong" tone="accent">
          Şifremi unuttum
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 }}>
        <Text variant="body" tone="secondary">
          Hesabın yok mu?
        </Text>
        <Pressable onPress={() => router.push('/register-type')} hitSlop={8}>
          <Text variant="bodyStrong" tone="accent">
            Kayıt ol
          </Text>
        </Pressable>
      </View>

      {DEMO_TOOLS ? (
        <Pressable onPress={() => setDemoOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28, marginBottom: 12 }}>
          <Icon name={demoOpen ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
          <Text variant="caption" tone="muted" style={{ fontWeight: '600' }}>
            Test hesapları
          </Text>
        </Pressable>
      ) : null}
      {DEMO_TOOLS && demoOpen ? (
        <>
          <Notice kind="info" text="Bunlar sunucuya yüklenmiş test hesaplarıdır. Dokununca doğrudan girilir. Sunucunun çalışıyor olması gerekir." />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {SEED_ACCOUNTS.map((account, i) => (
              <ListRow
                key={account.id}
                avatar={fullName(account)}
                title={fullName(account)}
                subtitle={`@${account.username}`}
                trailing={<Tag label={ROLE_LABELS[account.roleKey]} kind="accent" />}
                onPress={() => submit(account.username, DEMO_PASSWORD)}
                last={i === SEED_ACCOUNTS.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
