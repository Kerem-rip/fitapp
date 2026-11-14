// Tüm hesap türlerinde ortak: görünüm, bildirimler, çıkış, hesap silme ve demo sıfırlama.
// Hesap silme: şifreyle onaylanır, 30 gün geri dönüş süresi vardır (uygulama içinden yapılabilir).
import { BottomSheet, Button, Card, ListRow, Notice, Segmented, showToast, TextField, SectionHeader } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { deleteAccount, errorText, showApplicationStatus, signOut } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { setSurface, setTheme } from '@/demo/actions';
import { isProRole, useAccount, useDemoState, useSurface } from '@/demo/hooks';

type ThemePref = 'system' | 'light' | 'dark';

export function AccountSection() {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const applicationStatus = useAuth().me?.application?.status;
  const surface = useSurface();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!account) return null;

  const confirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteAccount(password);
      showToast('Hesap silme talebin alındı. 30 gün içinde giriş yaparsan iptal olur.', 'info');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
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
        {isProRole(account.roleKey) && surface === 'pro' ? (
          <ListRow
            icon="swap-horizontal-outline"
            title="Sosyal arayüze geç"
            subtitle="Akış, paylaşımların ve takip ettiklerin (aynı hesap)"
            onPress={() => {
              setSurface(account.id, 'social');
              router.replace('/');
            }}
          />
        ) : null}
        <ListRow icon="notifications-outline" title="Bildirimler" onPress={() => router.push('/notifications')} />
        {applicationStatus === 'PENDING' || applicationStatus === 'REJECTED' ? (
          <ListRow
            icon="ribbon-outline"
            title="Profesyonel başvurum"
            subtitle={applicationStatus === 'PENDING' ? 'İnceleniyor' : 'Reddedildi, yeniden gönderebilirsin'}
            onPress={showApplicationStatus}
          />
        ) : null}
        <ListRow icon="log-out-outline" title="Çıkış yap" subtitle={`@${account.username}`} onPress={() => void signOut()} />
        <ListRow icon="trash-outline" title="Hesabımı sil" subtitle="30 gün geri dönüş süresi vardır" onPress={() => setDeleteOpen(true)} last />
      </Card>

      <BottomSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Hesabını sil">
        <Notice
          kind="warning"
          text="Silme talebinden sonra 30 gün içinde giriş yaparsan hesabın geri gelir. 30 gün sonunda hesabın ve tüm verilerin kalıcı olarak silinir."
        />
        <TextField label="Şifren" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} secure error={error ?? undefined} />
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Button label={busy ? 'İşleniyor...' : 'Hesabımı sil'} variant="danger" size="lg" block disabled={busy} onPress={confirmDelete} />
          <Button label="Vazgeç" variant="ghost" block onPress={() => setDeleteOpen(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}
