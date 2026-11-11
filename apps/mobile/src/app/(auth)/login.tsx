// Giriş. Demo sürümde hazır hesaplara tek dokunuşla girilebilir.
import {
  Button,
  Card,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  showToast,
  Tag,
  TextField,
} from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { login, quickLogin } from '@/demo/actions';
import { ROLE_LABELS } from '@/demo/labels';
import { fullName } from '@/demo/selectors';
import { SEED_ACCOUNTS } from '@/demo/seed';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const afterLogin = (result: ReturnType<typeof login>) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (result.deletionCancelled) showToast('Hesap silme talebin iptal edildi. Tekrar hoş geldin!', 'info');
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
        onSubmitEditing={() => afterLogin(login(identifier, password))}
      />
      <Button label="Giriş yap" size="lg" block onPress={() => afterLogin(login(identifier, password))} />

      <SectionHeader title="Demo hesaplar" />
      <Notice
        kind="info"
        text="Bu bir demo sürümüdür. Aşağıdaki hesaplardan birine dokunarak o hesabın panelini görebilirsin. Veriler sadece bu telefonda saklanır."
      />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {SEED_ACCOUNTS.map((account, i) => (
          <ListRow
            key={account.id}
            avatar={fullName(account)}
            title={fullName(account)}
            subtitle={`@${account.username}`}
            trailing={<Tag label={ROLE_LABELS[account.roleKey]} kind="accent" />}
            onPress={() => afterLogin(quickLogin(account.id))}
            last={i === SEED_ACCOUNTS.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );
}
