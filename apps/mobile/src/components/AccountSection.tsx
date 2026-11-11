// Tüm hesap türlerinde ortak: görünüm, bildirimler, çıkış, hesap silme ve demo sıfırlama.
// Hesap silme: şifreyle onaylanır, 30 gün geri dönüş süresi vardır (uygulama içinden yapılabilir).
import { BottomSheet, Button, Card, ListRow, Notice, Segmented, showToast, TextField, Text, SectionHeader } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { logout, requestDeletion, resetDemo, setTheme } from '@/demo/actions';
import { useAccount, useDemoState } from '@/demo/hooks';
import { ConfirmSheet } from './ConfirmSheet';

type ThemePref = 'system' | 'light' | 'dark';

export function AccountSection() {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;

  const confirmDelete = () => {
    const result = requestDeletion(account.id, password);
    if (!result.ok) {
      setError(result.error ?? 'Şifre hatalı.');
      return;
    }
    setDeleteOpen(false);
    setPassword('');
    showToast('Hesap silme talebin alındı. 30 gün içinde giriş yaparsan iptal olur.', 'info');
  };

  return (
    <View>
      <SectionHeader title="Görünüm" />
      <Segmented<ThemePref>
        options={[
          { key: 'system', label: 'Sistem' },
          { key: 'light', label: 'Açık' },
          { key: 'dark', label: 'Koyu' },
        ]}
        value={state.ui.themePref}
        onChange={setTheme}
      />

      <SectionHeader title="Hesap" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="notifications-outline" title="Bildirimler" onPress={() => router.push('/notifications')} />
        <ListRow icon="log-out-outline" title="Çıkış yap" subtitle={`@${account.username}`} onPress={logout} />
        <ListRow icon="refresh-outline" title="Demo verilerini sıfırla" subtitle="Tüm hesaplar ve kayıtlar ilk haline döner" onPress={() => setResetOpen(true)} />
        <ListRow icon="trash-outline" title="Hesabımı sil" subtitle="30 gün geri dönüş süresi vardır" onPress={() => setDeleteOpen(true)} last />
      </Card>

      <BottomSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Hesabını sil">
        <Notice
          kind="warning"
          text="Silme talebinden sonra 30 gün içinde giriş yaparsan hesabın geri gelir. 30 gün sonunda hesabın ve tüm verilerin kalıcı olarak silinir."
        />
        <TextField label="Şifren" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} secure error={error ?? undefined} />
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Button label="Hesabımı sil" variant="danger" size="lg" block onPress={confirmDelete} />
          <Button label="Vazgeç" variant="ghost" block onPress={() => setDeleteOpen(false)} />
        </View>
        <Text variant="micro" tone="muted">
          Demo hesapların şifresi giriş ekranındaki demo hesap bilgisinde yazar.
        </Text>
      </BottomSheet>

      <ConfirmSheet
        visible={resetOpen}
        title="Demo verilerini sıfırla"
        text="Bu telefondaki tüm demo verileri (kayıt olan hesaplar, öğünler, mesajlar, randevular) silinir ve uygulama ilk haline döner."
        confirmLabel="Sıfırla"
        danger
        onConfirm={() => {
          resetDemo();
          showToast('Demo verileri sıfırlandı', 'info');
        }}
        onClose={() => setResetOpen(false)}
      />
    </View>
  );
}
