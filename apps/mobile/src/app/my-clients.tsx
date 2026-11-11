// Danışan teklifleri (diyetisyen ve bağımsız eğitmen): kullanıcı adıyla teklif gönder, yanıtı ve paylaşımı gör.
// Sağlık verisi bu listede gelmez; erişim, danışanın verdiği izinle ve denetim kaydıyla sunucuda sınırlıdır.
import type { ProfessionalRelationshipItem, RelationshipStatus } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, Screen, ScreenHeader, Segmented, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { formatDay, nameOf, SHARED_DATA_LABELS } from '@/features/sharing/labels';

const TABS: { key: Extract<RelationshipStatus, 'ACTIVE' | 'OFFERED'>; label: string }[] = [
  { key: 'ACTIVE', label: 'Danışanlarım' },
  { key: 'OFFERED', label: 'Yanıt bekleyen' },
];

export default function MyClientsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'ACTIVE' | 'OFFERED'>('ACTIVE');
  const [items, setItems] = useState<ProfessionalRelationshipItem[] | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [endTarget, setEndTarget] = useState<ProfessionalRelationshipItem | null>(null);

  const load = useCallback(async (status: 'ACTIVE' | 'OFFERED') => {
    try {
      setItems(await api.relationshipsAsProfessional(status));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(tab);
    }, [load, tab]),
  );

  const sendOffer = async () => {
    if (busy) return;
    const value = username.trim().replace(/^@/, '');
    if (value.length < 3) {
      setError('Kullanıcı adını yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.offerClient(value);
      setUsername('');
      showToast('Teklif gönderildi');
      setTab('OFFERED');
      await load('OFFERED');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!endTarget) return;
    try {
      await api.endRelationship(endTarget.id);
      showToast(endTarget.status === 'OFFERED' ? 'Teklif geri çekildi' : 'Danışanlık sonlandırıldı', 'info');
      await load(tab);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Danışan teklifleri" subtitle="Gerçek hesaplar" onBack={() => router.back()} />

      <Card>
        <Text variant="heading" style={{ marginBottom: 4 }}>
          Danışan ekle
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
          Kişinin kullanıcı adını yaz. Teklifi kabul ederse hangi bilgilerini paylaşacağını kendisi seçer.
        </Text>
        {error ? <Notice kind="warning" text={error} /> : null}
        <TextField label="Kullanıcı adı" value={username} onChangeText={(t) => { setUsername(t); setError(null); }} icon="at" onSubmitEditing={sendOffer} />
        <Button label={busy ? 'Gönderiliyor...' : 'Teklif gönder'} block disabled={busy} onPress={sendOffer} />
      </Card>

      <View style={{ height: 16 }} />
      <Segmented
        options={TABS}
        value={tab}
        onChange={(t) => {
          setItems(null);
          setTab(t);
        }}
      />

      {items && items.length === 0 ? (
        <EmptyState icon="people-outline" title={tab === 'ACTIVE' ? 'Henüz danışanın yok' : 'Yanıt bekleyen teklif yok'} />
      ) : null}
      {items?.map((item) => (
        <Card key={item.id} style={{ marginBottom: 10 }}>
          <Text variant="heading">{nameOf(item.client)}</Text>
          <Text variant="caption" tone="secondary">
            @{item.client.username}
          </Text>
          {item.status === 'ACTIVE' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {item.sharedData.length === 0 ? <Tag label="Henüz veri paylaşmıyor" kind="neutral" /> : null}
                {item.sharedData.map((t) => (
                  <Tag key={t} label={SHARED_DATA_LABELS[t]} kind={item.sharingExpired ? 'neutral' : 'accent'} />
                ))}
              </View>
              <Text variant="caption" tone={item.sharingExpired ? 'danger' : 'muted'} style={{ marginTop: 8 }}>
                {item.sharingExpired
                  ? 'Paylaşım süresi doldu; bilgilere erişemezsin.'
                  : item.sharedUntil
                    ? `${formatDay(item.sharedUntil)} tarihine kadar paylaşılıyor`
                    : 'Danışanlık bitene kadar paylaşılıyor'}
              </Text>
            </>
          ) : (
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
              {formatDay(item.offeredAt)} tarihinde gönderildi
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {item.status === 'ACTIVE' ? (
              <Button label="Dosyayı aç" icon="folder-open-outline" size="sm" onPress={() => router.push(`/client-file/${item.client.id}`)} />
            ) : null}
            <Button
              label={item.status === 'OFFERED' ? 'Teklifi geri çek' : 'Danışanlığı sonlandır'}
              variant="danger"
              size="sm"
              onPress={() => setEndTarget(item)}
            />
          </View>
        </Card>
      ))}

      <ConfirmSheet
        visible={endTarget !== null}
        title={endTarget?.status === 'OFFERED' ? 'Teklifi geri çek' : 'Danışanlığı sonlandır'}
        text={
          endTarget?.status === 'OFFERED'
            ? 'Teklif iptal edilir.'
            : `${endTarget ? nameOf(endTarget.client) : 'Danışan'} ile danışanlık biter ve verilerine erişimin hemen kapanır.`
        }
        confirmLabel={endTarget?.status === 'OFFERED' ? 'Geri çek' : 'Sonlandır'}
        danger
        onConfirm={end}
        onClose={() => setEndTarget(null)}
      />
    </Screen>
  );
}
