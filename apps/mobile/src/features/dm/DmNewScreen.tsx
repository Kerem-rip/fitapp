// Yeni mesaj / yeni grup / gönderiyi mesajla paylaş / gruba üye ekle: hepsi aynı kişi seçici üzerinden.
import type { UserCard } from '@fitapp/api-client';
import { Button, Screen, ScreenHeader, showToast, TextField } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { PeoplePicker } from './PeoplePicker';

type Mode = 'direct' | 'group' | 'share' | 'add';

export function DmNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: Mode; postId?: string; conversationId?: string; exclude?: string }>();
  const mode: Mode = params.mode ?? 'direct';
  const [selected, setSelected] = useState<UserCard[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const multi = mode !== 'direct';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages'));
  const toggle = (p: UserCard) => {
    if (!multi) {
      void openDirect(p);
      return;
    }
    setSelected((prev) => (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
  };

  const openDirect = async (p: UserCard) => {
    try {
      const c = await api.dmOpenDirect(p.id);
      router.replace(`/dm/${c.id}`);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'group') {
        const g = await api.dmCreateGroup(title.trim(), selected.map((s) => s.id));
        router.replace(`/dm/${g.id}`);
      } else if (mode === 'share' && params.postId) {
        // Seçilen her kişiye ayrı ayrı gönderilir; gönderilemeyenler bildirilir
        const results = await Promise.allSettled(selected.map((s) => api.dmSendToUser(s.id, { postId: params.postId })));
        const failed = results.filter((r) => r.status === 'rejected').length;
        showToast(failed ? `${selected.length - failed} kişiye gönderildi, ${failed} kişiye gönderilemedi` : 'Gönderildi', failed ? 'warning' : 'success');
        back();
      } else if (mode === 'add' && params.conversationId) {
        await api.dmAddMembers(params.conversationId, selected.map((s) => s.id));
        showToast('Eklendi');
        back();
      }
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = { direct: 'Yeni mesaj', group: 'Yeni grup', share: 'Mesajla gönder', add: 'Üye ekle' };
  const ready = !busy && (mode === 'group' ? selected.length >= 2 && title.trim().length > 0 : selected.length >= 1);

  return (
    <Screen>
      <ScreenHeader title={titles[mode]} subtitle={multi && selected.length ? `${selected.length} kişi seçildi` : undefined} onBack={back} />
      {mode === 'group' ? <TextField label="Grup adı" value={title} onChangeText={setTitle} maxLength={60} autoCapitalize="sentences" hint="En az iki kişi seç" /> : null}
      <PeoplePicker selected={selected.map((s) => s.id)} onToggle={toggle} exclude={params.exclude ? params.exclude.split(',') : []} />
      {multi ? <Button label={mode === 'group' ? 'Grubu oluştur' : mode === 'share' ? 'Gönder' : 'Ekle'} block onPress={submit} disabled={!ready} style={{ marginTop: 16 }} /> : null}
    </Screen>
  );
}
