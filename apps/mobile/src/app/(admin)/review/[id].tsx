// Yönetici: tek başvuruyu incele. Otomatik kontroller sadece uyarı verir; kararı insan verir.
import type { AdminApplicationDetail, AdminDocument } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { KIND_LABELS } from '@/components/DocumentPicker';
import { FIELD_LABELS } from '@/components/RegisterForm';

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export default function ReviewScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ name: string; uri: string } | null>(null);

  useEffect(() => {
    api
      .adminApplication(id)
      .then(setDetail)
      .catch((e) => setError(errorText(e)));
  }, [id]);

  const openDocument = async (doc: AdminDocument) => {
    try {
      const file = await api.adminDocument(doc.id);
      if (file.mimeType.startsWith('image/')) {
        setPreview({ name: doc.originalName, uri: `data:${file.mimeType};base64,${toBase64(file.data)}` });
      } else if (Platform.OS === 'web') {
        window.open(URL.createObjectURL(new Blob([file.data], { type: file.mimeType })), '_blank');
      } else {
        showToast('PDF belgeler şimdilik web üzerinden açılır', 'info');
      }
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const decide = async (action: 'approve' | 'reject') => {
    if (busy || !detail) return;
    if (action === 'reject' && reason.trim().length < 5) {
      showToast('Red nedenini en az 5 karakterle yaz', 'warning');
      return;
    }
    setBusy(true);
    try {
      if (action === 'approve') await api.adminApprove(detail.id);
      else await api.adminReject(detail.id, reason.trim());
      showToast(action === 'approve' ? 'Başvuru onaylandı' : 'Başvuru reddedildi', 'success');
      router.back();
    } catch (e) {
      setError(errorText(e));
      setRejectOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return (
      <Screen>
        <ScreenHeader title="Başvuru" onBack={() => router.back()} />
        {error ? <Notice kind="danger" text={error} /> : <Text tone="muted">Yükleniyor...</Text>}
      </Screen>
    );
  }

  const name = [detail.user.firstName, detail.user.lastName].filter(Boolean).join(' ') || detail.user.username;
  const decided = detail.status !== 'PENDING';

  return (
    <Screen>
      <ScreenHeader title={name} subtitle={`${FIELD_LABELS[detail.field]} · @${detail.user.username}`} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {decided ? (
        <Notice
          kind={detail.status === 'APPROVED' ? 'success' : 'danger'}
          title={detail.status === 'APPROVED' ? 'Onaylandı' : 'Reddedildi'}
          text={detail.rejectionReason ?? (detail.reviewedAt ? dateOf(detail.reviewedAt) : '')}
        />
      ) : null}

      <Card>
        <Text variant="caption" tone="muted">E-posta</Text>
        <Text variant="body">{detail.user.email}</Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Doğum tarihi</Text>
        <Text variant="body">{dateOf(detail.user.birthDate)}</Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Şehir</Text>
        <Text variant="body">{detail.details.city}</Text>
        {detail.details.gymName ? (
          <>
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Salon</Text>
            <Text variant="body">{detail.details.gymName}{detail.details.gymAddress ? ` · ${detail.details.gymAddress}` : ''}</Text>
          </>
        ) : null}
        {detail.details.specialties?.length ? (
          <>
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Uzmanlık</Text>
            <Text variant="body">{detail.details.specialties.join(', ')}</Text>
          </>
        ) : null}
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Başvuru</Text>
        <Text variant="body">{dateOf(detail.submittedAt)} · {detail.attemptNumber}. başvuru</Text>
      </Card>

      <SectionHeader title="Belgeler" />
      {detail.documents.map((doc) => (
        <Card key={doc.id} style={{ marginBottom: 10 }}>
          <Text variant="bodyStrong">{KIND_LABELS[doc.kind]}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {doc.originalName} · {(doc.sizeBytes / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} KB
          </Text>
          {doc.flags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {doc.flags.map((f) => (
                <Tag key={f.code} label={f.label} kind="danger" icon="flag" />
              ))}
            </View>
          ) : null}
          <Button label="Belgeyi aç" variant="secondary" size="sm" icon="eye-outline" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => openDocument(doc)} />
        </Card>
      ))}

      <SectionHeader title="Kontrol listesi" />
      <Card>
        {detail.checklist.map((line, i) => (
          <Text key={i} variant="caption" tone="secondary" style={{ marginBottom: 4 }}>
            • {line}
          </Text>
        ))}
        <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
          Otomatik işaretler yalnızca uyarıdır; son karar sizindir.
        </Text>
      </Card>

      {detail.previousAttempts.length > 0 ? (
        <>
          <SectionHeader title="Önceki başvurular" />
          <Card>
            {detail.previousAttempts.map((a) => (
              <View key={a.id} style={{ marginBottom: 6 }}>
                <Text variant="bodyStrong">{a.attemptNumber}. başvuru · {dateOf(a.submittedAt)}</Text>
                <Text variant="caption" tone="secondary">{a.rejectionReason ?? a.status}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {!decided ? (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button label={busy ? 'İşleniyor...' : 'Onayla'} size="lg" block disabled={busy} onPress={() => decide('approve')} />
          <Button label="Reddet" variant="danger" size="lg" block disabled={busy} onPress={() => setRejectOpen(true)} />
        </View>
      ) : null}

      <BottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)} title="Red nedeni">
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          Başvuran bu nedeni görecek ve belgelerini yeniden gönderebilecek.
        </Text>
        <TextField label="Neden" value={reason} onChangeText={setReason} multiline />
        <Button label={busy ? 'İşleniyor...' : 'Reddet'} variant="danger" block disabled={busy} onPress={() => decide('reject')} />
      </BottomSheet>

      <BottomSheet visible={preview !== null} onClose={() => setPreview(null)} title={preview?.name ?? ''}>
        {preview ? <Image source={{ uri: preview.uri }} resizeMode="contain" style={{ width: '100%', height: 420, backgroundColor: c.surfaceAlt, borderRadius: 12 }} /> : null}
      </BottomSheet>
    </Screen>
  );
}
