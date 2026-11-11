// Paylaşım ve erişim (danışan): gelen teklifler, kimle ne paylaştığım ve verime kimin baktığı.
// Paylaşımı istediğim an değiştirir ya da bitiririm; bittiği an uzmanın erişimi kapanır.
import type { AuditEntry, ClientRelationshipItem, SharedDataType } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SectionHeader, Segmented, showToast, SwitchRow, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import {
  auditSentence,
  formatDateTime,
  formatDay,
  nameOf,
  periodToIso,
  SHARE_PERIODS,
  SHARED_DATA_HINTS,
  SHARED_DATA_LABELS,
  SHARED_DATA_ORDER,
  type SharePeriodKey,
} from '@/features/sharing/labels';

const AUDIT_PAGE = 20;

type Editing = { item: ClientRelationshipItem; mode: 'accept' | 'edit' } | null;

export default function SharingScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [items, setItems] = useState<ClientRelationshipItem[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditMore, setAuditMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Editing>(null);
  const [selected, setSelected] = useState<SharedDataType[]>([]);
  const [period, setPeriod] = useState<SharePeriodKey>('forever');
  const [keepPeriod, setKeepPeriod] = useState(true);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [endTarget, setEndTarget] = useState<ClientRelationshipItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, log] = await Promise.all([api.relationshipsAsClient(), api.auditLog({ limit: AUDIT_PAGE })]);
      setItems(list);
      setAudit(log);
      setAuditMore(log.length === AUDIT_PAGE);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadMore = async () => {
    const last = audit[audit.length - 1];
    if (!last) return;
    try {
      const more = await api.auditLog({ limit: AUDIT_PAGE, before: last.createdAt });
      setAudit((cur) => [...cur, ...more]);
      setAuditMore(more.length === AUDIT_PAGE);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const open = (item: ClientRelationshipItem, mode: 'accept' | 'edit') => {
    setEditing({ item, mode });
    setSelected(item.sharedData);
    setPeriod('forever');
    setKeepPeriod(mode === 'edit');
    setSheetError(null);
  };

  const toggle = (type: SharedDataType) =>
    setSelected((cur) => (cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]));

  const save = async () => {
    if (!editing || busy) return;
    setBusy(true);
    setSheetError(null);
    try {
      if (editing.mode === 'accept') {
        await api.acceptOffer(editing.item.id, { sharedData: selected, sharedUntil: periodToIso(period) });
        showToast('Danışanlık başladı');
      } else {
        await api.updateSharing(editing.item.id, {
          sharedData: selected,
          ...(keepPeriod ? {} : { sharedUntil: periodToIso(period) }),
        });
        showToast('Paylaşım ayarın güncellendi');
      }
      setEditing(null);
      await load();
    } catch (e) {
      setSheetError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const decline = async (item: ClientRelationshipItem) => {
    try {
      await api.declineOffer(item.id);
      showToast('Teklif reddedildi', 'info');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const end = async () => {
    if (!endTarget) return;
    try {
      await api.endRelationship(endTarget.id);
      showToast('Danışanlık sonlandırıldı', 'info');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const offers = items?.filter((i) => i.status === 'OFFERED') ?? [];
  const active = items?.filter((i) => i.status === 'ACTIVE') ?? [];

  return (
    <Screen>
      <ScreenHeader title="Paylaşım ve erişim" subtitle="Verini kim görüyor?" onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {offers.length > 0 ? (
        <>
          <SectionHeader title="Gelen teklifler" />
          {offers.map((item) => (
            <Card key={item.id} style={{ marginBottom: 10 }}>
              <Text variant="heading">{nameOf(item.professional)}</Text>
              <Text variant="caption" tone="secondary">
                {item.professional.title ?? 'Uzman'}
                {item.professional.city ? ` · ${item.professional.city}` : ''} · @{item.professional.username}
              </Text>
              <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
                Seni danışanı olarak eklemek istiyor. Kabul edersen hangi bilgilerini göreceğini sen seçersin.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Kabul et" onPress={() => open(item, 'accept')} block />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Reddet" variant="secondary" onPress={() => decline(item)} block />
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Danışanlıklarım" />
      {items && active.length === 0 ? (
        <EmptyState icon="people-outline" title="Aktif danışanlığın yok" text="Bir uzman sana teklif gönderirse burada görünür." />
      ) : null}
      {active.map((item) => (
        <Card key={item.id} style={{ marginBottom: 10 }}>
          <Text variant="heading">{nameOf(item.professional)}</Text>
          <Text variant="caption" tone="secondary">
            {item.professional.title ?? 'Uzman'} · @{item.professional.username}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {item.sharedData.length === 0 ? <Tag label="Hiçbir veri paylaşılmıyor" kind="neutral" /> : null}
            {item.sharedData.map((t) => (
              <Tag key={t} label={SHARED_DATA_LABELS[t]} kind={item.sharingExpired ? 'neutral' : 'accent'} />
            ))}
          </View>
          <Text variant="caption" tone={item.sharingExpired ? 'danger' : 'muted'} style={{ marginTop: 8 }}>
            {item.sharingExpired
              ? 'Paylaşım süresi doldu; uzman şu an hiçbir verini göremez.'
              : item.sharedUntil
                ? `${formatDay(item.sharedUntil)} tarihine kadar paylaşılıyor`
                : 'Danışanlık bitene kadar paylaşılıyor'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Button label="Paylaşımı düzenle" variant="secondary" size="sm" onPress={() => open(item, 'edit')} block />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Sonlandır" variant="danger" size="sm" onPress={() => setEndTarget(item)} block />
            </View>
          </View>
        </Card>
      ))}

      <SectionHeader title="Verime kim baktı?" />
      <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
        Uzmanların sağlık verine her erişimi ve paylaşım değişiklikleri burada kayıtlıdır.
      </Text>
      {audit.length === 0 ? (
        <Text variant="caption" tone="muted">
          Henüz kayıt yok.
        </Text>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {audit.map((entry, i) => (
            <ListRow
              key={entry.id}
              icon={entry.action === 'ACCESS_DENIED' ? 'close-circle-outline' : entry.action === 'DATA_VIEWED' ? 'eye-outline' : 'time-outline'}
              title={auditSentence(entry, me?.username ?? '')}
              subtitle={formatDateTime(entry.createdAt)}
              last={i === audit.length - 1}
            />
          ))}
        </Card>
      )}
      {auditMore ? <Button label="Daha eski kayıtlar" variant="ghost" onPress={loadMore} style={{ marginTop: 8 }} /> : null}

      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'accept' ? 'Ne paylaşacaksın?' : 'Paylaşımı düzenle'}
      >
        {editing ? (
          <>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
              {nameOf(editing.item.professional)} yalnızca işaretlediğin bilgileri görür. İstediğin zaman değiştirebilirsin.
            </Text>
            {sheetError ? <Notice kind="warning" text={sheetError} /> : null}
            {SHARED_DATA_ORDER.map((type, i) => (
              <SwitchRow
                key={type}
                title={SHARED_DATA_LABELS[type]}
                description={SHARED_DATA_HINTS[type]}
                value={selected.includes(type)}
                onChange={() => toggle(type)}
                last={i === SHARED_DATA_ORDER.length - 1}
              />
            ))}
            <Text variant="caption" tone="secondary" style={{ marginTop: 12, marginBottom: 6, fontWeight: '600' }}>
              Ne kadar süreyle?
            </Text>
            {editing.mode === 'edit' && editing.item.sharedUntil && keepPeriod ? (
              <View style={{ marginBottom: 8 }}>
                <Text variant="caption" tone="muted">
                  Şu an: {formatDay(editing.item.sharedUntil)} tarihine kadar.
                </Text>
                <Button label="Süreyi değiştir" variant="ghost" size="sm" onPress={() => setKeepPeriod(false)} style={{ alignSelf: 'flex-start' }} />
              </View>
            ) : editing.mode === 'edit' && !editing.item.sharedUntil && keepPeriod ? (
              <View style={{ marginBottom: 8 }}>
                <Text variant="caption" tone="muted">
                  Şu an: süresiz.
                </Text>
                <Button label="Süre koy" variant="ghost" size="sm" onPress={() => setKeepPeriod(false)} style={{ alignSelf: 'flex-start' }} />
              </View>
            ) : (
              <Segmented options={SHARE_PERIODS.map((p) => ({ key: p.key, label: p.label }))} value={period} onChange={setPeriod} />
            )}
            <Button label={busy ? 'Kaydediliyor...' : editing.mode === 'accept' ? 'Kabul et' : 'Kaydet'} size="lg" block disabled={busy} onPress={save} style={{ marginBottom: 8 }} />
          </>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        visible={endTarget !== null}
        title="Danışanlığı sonlandır"
        text={`${endTarget ? nameOf(endTarget.professional) : 'Uzman'} verilerine erişimi hemen kapanır.`}
        confirmLabel="Sonlandır"
        danger
        onConfirm={end}
        onClose={() => setEndTarget(null)}
      />
    </Screen>
  );
}
