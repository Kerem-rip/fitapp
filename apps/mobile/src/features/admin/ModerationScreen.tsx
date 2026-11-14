// Moderasyon (yönetici ve moderatör): şikâyet kuyruğu ve itirazlar.
// Özel mesaj şikâyetinde sadece şikâyet edilen mesaj gösterilir; her görüntüleme ve karar kayıt defterine yazılır.
import type { ModerationAppealItem, ModerationReportDetail, ModerationReportItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, Notice, Screen, ScreenHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { REASON_LABELS } from '@/components/social/ReportSheet';
import { timeAgo } from '@/demo/dates';

const TARGET: Record<string, string> = { POST: 'Gönderi', COMMENT: 'Yorum', STORY: 'Hikâye', USER: 'Kişi', DM_MESSAGE: 'Özel mesaj' };
type Tab = 'reports' | 'appeals';

export function ModerationScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<ModerationReportItem[] | null>(null);
  const [appeals, setAppeals] = useState<ModerationAppealItem[] | null>(null);
  const [detail, setDetail] = useState<ModerationReportDetail | null>(null);
  const [appeal, setAppeal] = useState<ModerationAppealItem | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    Promise.all([api.moderationReports('OPEN'), api.moderationAppeals('OPEN')])
      .then(([r, a]) => {
        setReports(r);
        setAppeals(a);
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  }, []);
  useFocusEffect(load);

  const open = async (id: string) => {
    try {
      setNote('');
      setDetail(await api.moderationReport(id));
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const resolve = async (action: 'REMOVE' | 'DISMISS') => {
    if (!detail) return;
    try {
      await api.resolveReport(detail.id, action, note.trim() || null);
      showToast(action === 'REMOVE' ? 'İçerik kaldırıldı' : 'Şikâyet kapatıldı');
      setDetail(null);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const decide = async (accept: boolean) => {
    if (!appeal) return;
    try {
      await api.decideAppeal(appeal.id, accept, note.trim() || null);
      showToast(accept ? 'İçerik geri getirildi' : 'İtiraz reddedildi');
      setAppeal(null);
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Moderasyon" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ChipRow
        options={[
          { key: 'reports' as const, label: `Şikâyetler${reports?.length ? ` (${reports.length})` : ''}` },
          { key: 'appeals' as const, label: `İtirazlar${appeals?.length ? ` (${appeals.length})` : ''}` },
        ]}
        selected={[tab]}
        onToggle={setTab}
      />
      <View style={{ height: 12 }} />

      {tab === 'reports' ? (
        <>
          {reports && reports.length === 0 ? <EmptyState icon="shield-checkmark-outline" title="Bekleyen şikâyet yok" /> : null}
          {reports?.map((r) => (
            <Card key={r.id} onPress={() => open(r.id)}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <Tag label={TARGET[r.targetType] ?? r.targetType} kind="info" />
                <Tag label={REASON_LABELS[r.reason] ?? r.reason} kind="warning" />
                {r.sameTargetReports > 1 ? <Tag label={`${r.sameTargetReports} şikâyet`} kind="danger" /> : null}
              </View>
              <Text variant="bodyStrong">{r.targetUsername ? `@${r.targetUsername}` : 'Bilinmeyen hesap'}</Text>
              <Text variant="caption" tone="secondary">
                {timeAgo(r.createdAt)} önce{r.details ? ` · “${r.details}”` : ''}
              </Text>
            </Card>
          ))}
        </>
      ) : (
        <>
          {appeals && appeals.length === 0 ? <EmptyState icon="chatbox-ellipses-outline" title="Bekleyen itiraz yok" /> : null}
          {appeals?.map((a) => (
            <Card
              key={a.id}
              onPress={() => {
                setNote('');
                setAppeal(a);
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                <Tag label={TARGET[a.targetType] ?? a.targetType} kind="info" />
              </View>
              <Text variant="bodyStrong">@{a.username}</Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {a.text}
              </Text>
            </Card>
          ))}
        </>
      )}

      <BottomSheet visible={detail !== null} onClose={() => setDetail(null)} title="Şikâyet">
        {detail ? (
          <>
            <Text variant="caption" tone="secondary">
              {TARGET[detail.targetType]} · {REASON_LABELS[detail.reason]} · şikâyet eden: @{detail.reporterUsername ?? '?'}
            </Text>
            {detail.details ? (
              <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                Açıklama: {detail.details}
              </Text>
            ) : null}
            {detail.targetType === 'DM_MESSAGE' ? <Notice kind="warning" text="Özel mesaj: sadece şikâyet edilen mesaj gösterilir. Bu görüntüleme kayıt defterine yazıldı." /> : null}
            <Card variant="soft" style={{ marginTop: 10 }}>
              <Text variant="caption" tone="muted">
                {detail.owner ? `@${detail.owner.username}` : 'Hesap'} yazdı:
              </Text>
              <Text variant="body" style={{ marginTop: 4 }}>
                {detail.content?.text ?? (detail.targetType === 'USER' ? '(hesap şikâyeti)' : '(metinsiz içerik)')}
              </Text>
              {detail.content?.mediaCount ? (
                <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                  {detail.content.mediaCount} medya eki
                </Text>
              ) : null}
            </Card>
            <TextField label="Gerekçe (kaldırma için zorunlu)" value={note} onChangeText={setNote} multiline maxLength={500} autoCapitalize="sentences" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="İhlal yok" variant="secondary" block onPress={() => resolve('DISMISS')} />
              </View>
              {detail.targetType !== 'USER' ? (
                <View style={{ flex: 1 }}>
                  <Button label="İçeriği kaldır" variant="danger" block onPress={() => resolve('REMOVE')} disabled={!note.trim()} />
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={appeal !== null} onClose={() => setAppeal(null)} title="İtiraz">
        {appeal ? (
          <>
            <Text variant="caption" tone="secondary">
              @{appeal.username} · {TARGET[appeal.targetType]}
            </Text>
            <Card variant="soft" style={{ marginTop: 10 }}>
              <Text variant="caption" tone="muted">
                Kaldırılan içerik
              </Text>
              <Text variant="body" style={{ marginTop: 4 }}>
                {appeal.content?.text ?? '(metinsiz içerik)'}
              </Text>
            </Card>
            <Text variant="body" style={{ marginBottom: 8 }}>
              İtiraz: {appeal.text}
            </Text>
            <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} multiline maxLength={500} autoCapitalize="sentences" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="Reddet" variant="secondary" block onPress={() => decide(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Geri getir" block onPress={() => decide(true)} />
              </View>
            </View>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
