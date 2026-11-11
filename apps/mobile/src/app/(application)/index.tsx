// Başvuru durumu: inceleniyor / reddedildi. Kişi isterse aynı hesapla normal kullanıcı olarak devam edebilir.
import { Button, Card, Icon, Notice, Screen, ScreenHeader, showToast, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { continueAsNormalUser, errorText, refreshMe, signOut } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { DocumentPicker, type PickedDoc } from '@/components/DocumentPicker';
import { FIELD_DOC_KINDS, FIELD_LABELS } from '@/components/RegisterForm';

const MAX_ATTEMPTS = 3;

export default function ApplicationStatusScreen() {
  const { c, accent, accentSoft } = useTheme();
  const { me } = useAuth();
  const application = me?.application ?? null;
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [resubmitting, setResubmitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ekran açılınca sunucudaki güncel durum alınır (karar verilmiş olabilir)
  useEffect(() => {
    refreshMe().catch(() => {});
  }, []);

  if (!application) return null;
  const rejected = application.status === 'REJECTED';
  const field = application.field;

  const submit = async () => {
    if (docs.length === 0) {
      setError('En az bir belge eklemelisin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resubmitApplication(docs.map((d) => ({ file: d.file, kind: d.kind })));
      setDocs([]);
      setResubmitting(false);
      await refreshMe();
      showToast('Başvurun yeniden gönderildi', 'success');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Başvurun" subtitle={FIELD_LABELS[field]} trailing={<Tag label={rejected ? 'Reddedildi' : 'İnceleniyor'} kind={rejected ? 'danger' : 'warning'} />} />

      <Card>
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: rejected ? c.dangerSoft : accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={rejected ? 'close-circle' : 'time'} size={36} color={rejected ? c.danger : accent} />
          </View>
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {rejected ? 'Başvurun onaylanmadı' : 'Başvurun onay sürecine alındı'}
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            {rejected
              ? 'Aşağıdaki nedeni inceleyip belgelerini yeniden gönderebilirsin.'
              : 'Belgelerin inceleniyor. Sonuç bildirimle ve bu ekranda görünür. Beklerken uygulamayı normal kullanıcı olarak kullanabilirsin.'}
          </Text>
        </View>
      </Card>

      {rejected && application.rejectionReason ? (
        <Notice kind="danger" title="Red nedeni" text={application.rejectionReason} />
      ) : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      {rejected ? (
        application.canResubmit ? (
          resubmitting ? (
            <>
              <Text variant="heading" style={{ marginTop: 8, marginBottom: 10 }}>
                Yeni belgeler
              </Text>
              <DocumentPicker docs={docs} onChange={setDocs} kinds={FIELD_DOC_KINDS[field]} />
              <View style={{ height: 12 }} />
              <Button label={busy ? 'Gönderiliyor...' : 'Yeniden gönder'} size="lg" block disabled={busy} onPress={submit} />
              <View style={{ height: 8 }} />
              <Button label="Vazgeç" variant="ghost" block onPress={() => setResubmitting(false)} />
            </>
          ) : (
            <Button label={`Belgeleri yeniden gönder (${application.attemptNumber}/${MAX_ATTEMPTS})`} size="lg" block onPress={() => setResubmitting(true)} />
          )
        ) : (
          <Notice kind="warning" text={`En fazla ${MAX_ATTEMPTS} kez başvurulabilir. Yeni başvuru hakkın kalmadı; destek ekibiyle iletişime geçebilirsin.`} />
        )
      ) : null}

      <View style={{ height: 12 }} />
      <Button label="Normal kullanıcı olarak devam et" variant="secondary" size="lg" block onPress={continueAsNormalUser} />
      <View style={{ height: 8 }} />
      <Button label="Çıkış yap" variant="ghost" block onPress={() => void signOut()} />
    </Screen>
  );
}
