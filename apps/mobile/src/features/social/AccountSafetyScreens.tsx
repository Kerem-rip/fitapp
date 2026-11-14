// Kaldırılan içeriklerim (itiraz) ve Açık oturumlar (cihazlar).
import type { ModerationNotice, SessionItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatShort, timeAgo } from '@/demo/dates';

const KIND: Record<ModerationNotice['targetType'], string> = { POST: 'Gönderi', COMMENT: 'Yorum', STORY: 'Hikâye' };
const APPEAL: Record<'OPEN' | 'ACCEPTED' | 'REJECTED', { label: string; kind: 'info' | 'success' | 'neutral' }> = {
  OPEN: { label: 'İtiraz inceleniyor', kind: 'info' },
  ACCEPTED: { label: 'İtiraz kabul edildi', kind: 'success' },
  REJECTED: { label: 'İtiraz reddedildi', kind: 'neutral' },
};

export function ModerationNoticesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ModerationNotice[] | null>(null);
  const [target, setTarget] = useState<ModerationNotice | null>(null);
  const [text, setText] = useState('');

  const load = useCallback(() => {
    api
      .moderationNotices()
      .then(setItems)
      .catch((e) => showToast(errorText(e), 'warning'));
  }, []);
  useFocusEffect(load);

  const submit = async () => {
    if (!target) return;
    try {
      await api.appeal({ targetType: target.targetType, targetId: target.targetId, text: text.trim() });
      showToast('İtirazın alındı. Başka bir moderatör inceleyecek.');
      setTarget(null);
      setText('');
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Kaldırılan içeriklerim" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Notice kind="info" text="Topluluk kurallarına aykırı bulunan içerikler kaldırılır. Her içerik için bir kez itiraz edebilirsin; itirazı içeriği kaldıran kişiden başka bir moderatör inceler." />
      {items && items.length === 0 ? <EmptyState icon="shield-checkmark-outline" title="Kaldırılan içeriğin yok" /> : null}
      {items?.map((n) => (
        <Card key={`${n.targetType}-${n.targetId}`}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label={KIND[n.targetType]} />
            {n.appeal ? <Tag label={APPEAL[n.appeal.status].label} kind={APPEAL[n.appeal.status].kind} /> : null}
          </View>
          <Text variant="body">{n.preview || '(metinsiz içerik)'}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {formatShort(n.removedAt.slice(0, 10))} tarihinde kaldırıldı
          </Text>
          {n.appeal?.note ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              Moderatör notu: {n.appeal.note}
            </Text>
          ) : null}
          {!n.appeal ? <Button label="İtiraz et" size="sm" variant="secondary" onPress={() => setTarget(n)} style={{ marginTop: 10, alignSelf: 'flex-start' }} /> : null}
        </Card>
      ))}

      <BottomSheet visible={target !== null} onClose={() => setTarget(null)} title="İtiraz et">
        <TextField label="Neden kurallara uygun olduğunu düşünüyorsun?" value={text} onChangeText={setText} multiline maxLength={500} autoCapitalize="sentences" />
        <Button label="İtirazı gönder" block onPress={submit} disabled={!text.trim()} />
      </BottomSheet>
    </Screen>
  );
}

export function SessionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[] | null>(null);

  const load = useCallback(() => {
    api
      .sessions()
      .then(setItems)
      .catch((e) => showToast(errorText(e), 'warning'));
  }, []);
  useFocusEffect(load);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      showToast(message);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const others = items?.filter((s) => !s.current) ?? [];

  return (
    <Screen>
      <ScreenHeader title="Açık oturumlar" subtitle="Hesabına giriş yapılmış cihazlar" onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      {items ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((s, i) => (
            <ListRow
              key={s.id}
              icon="phone-portrait-outline"
              title={s.deviceName ?? 'Bilinmeyen cihaz'}
              subtitle={s.current ? 'Bu cihaz' : `Son etkinlik: ${timeAgo(s.lastActiveAt)} önce`}
              trailing={s.current ? <Tag label="Şu an" kind="success" /> : <Button label="Kapat" size="sm" variant="secondary" onPress={() => run(() => api.revokeSession(s.id), 'Oturum kapatıldı')} />}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {others.length > 0 ? <Button label="Diğer tüm oturumları kapat" variant="danger" block onPress={() => run(() => api.revokeOtherSessions(), 'Diğer oturumlar kapatıldı')} /> : null}
      <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
        Tanımadığın bir cihaz görürsen oturumunu kapat ve şifreni değiştir.
      </Text>
    </Screen>
  );
}
