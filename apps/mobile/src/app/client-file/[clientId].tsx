// Danışan dosyası (diyetisyen ve bağımsız eğitmen). Sadece danışanın paylaştığı bilgiler gelir;
// paylaşılmayan kategoriler hiç görünmez. Sunucu her bakışı ve değişikliği denetim kaydına yazar.
import type { AnamnesisResponse, ClientFileSummary, IntakeQuestionType, IntakeQuestionView, MeasurementItem, MeasurementKind, NoteItem, TimelineItem } from '@fitapp/api-client';
import { BarChart, BottomSheet, Button, Card, EmptyState, ListRow, Notice, ProgressBar, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { AnswerSheet, answerText } from '@/components/AnswerSheet';
import { ChipRow } from '@/components/ChipRow';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { MeasurementSheet } from '@/components/MeasurementSheet';
import { changeText, formatFullDate, formatShortDate, formatValue, KIND_LABELS, KIND_ORDER, METHOD_LABELS, mixedMethods, SOURCE_LABELS } from '@/features/health/labels';
import { FollowTab } from '@/features/agenda/FollowTab';
import { MODE_LABELS, STATUS_TAGS } from '@/features/agenda/helpers';
import { PlanTab } from '@/features/plans/PlanTab';
import { ProgramTab } from '@/features/programs/ProgramTab';
import { WorkoutsTab } from '@/features/programs/WorkoutsTab';
import { useAccount } from '@/demo/hooks';
import { ReviewTab } from '@/features/review/ReviewTab';
import { formatDateTime, SHARED_DATA_LABELS, SHARED_DATA_ORDER } from '@/features/sharing/labels';

type Tab = 'review' | 'summary' | 'plan' | 'program' | 'workouts' | 'follow' | 'measurements' | 'anamnesis' | 'notes' | 'timeline';

// Diyetisyen beslenme planı, antrenör egzersiz programı ve antrenman kayıtları sekmelerini görür
const tabsFor = (trainer: boolean): { key: Tab; label: string }[] => [
  { key: 'review', label: 'İnceleme' },
  { key: 'summary', label: 'Özet' },
  ...(trainer
    ? [
        { key: 'program' as const, label: 'Program' },
        { key: 'workouts' as const, label: 'Antrenmanlar' },
      ]
    : [{ key: 'plan' as const, label: 'Plan' }]),
  { key: 'follow', label: 'Takip' },
  { key: 'measurements', label: 'Ölçümler' },
  { key: 'anamnesis', label: 'Anamnez' },
  { key: 'notes', label: 'Notlar' },
  { key: 'timeline', label: 'Zaman çizelgesi' },
];

const QUESTION_TYPES: { key: IntakeQuestionType; label: string }[] = [
  { key: 'TEXT', label: 'Metin' },
  { key: 'NUMBER', label: 'Sayı' },
  { key: 'SINGLE_CHOICE', label: 'Tek seçim' },
  { key: 'MULTI_CHOICE', label: 'Çoklu seçim' },
];

export default function ClientFileScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const account = useAccount();
  const [tab, setTab] = useState<Tab>('review');
  const [summary, setSummary] = useState<ClientFileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api.clientFile(clientId));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  const visible = summary?.sharing.visible ?? [];
  const hidden = SHARED_DATA_ORDER.filter((c) => !visible.includes(c));

  return (
    <Screen>
      <ScreenHeader title={summary?.client.name ?? 'Danışan'} subtitle={summary ? `@${summary.client.username}` : undefined} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <ChipRow options={tabsFor(account?.roleKey === 'trainer')} selected={[tab]} onToggle={setTab} />

      {summary && hidden.length > 0 ? (
        <Notice
          kind="info"
          title="Danışanın paylaşmadığı bilgiler"
          text={`${hidden.map((c) => SHARED_DATA_LABELS[c]).join(', ')}. Bunlar dosyada görünmez; danışan paylaşımı açarsa görünür.`}
        />
      ) : null}

      {summary ? (
        <>
          {tab === 'review' ? <ReviewTab clientId={clientId} onChanged={loadSummary} /> : null}
          {tab === 'summary' ? <SummaryTab summary={summary} onGo={setTab} /> : null}
          {tab === 'plan' ? <PlanTab clientId={clientId} mealsVisible={visible.includes('MEALS')} /> : null}
          {tab === 'program' ? <ProgramTab clientId={clientId} /> : null}
          {tab === 'workouts' ? <WorkoutsTab clientId={clientId} visible={visible.includes('WORKOUTS')} /> : null}
          {tab === 'follow' ? <FollowTab clientId={clientId} onChanged={loadSummary} /> : null}
          {tab === 'measurements' ? <MeasurementsTab clientId={clientId} visible={visible} onChanged={loadSummary} /> : null}
          {tab === 'anamnesis' ? <AnamnesisTab clientId={clientId} canView={visible.includes('ANAMNESIS')} onChanged={loadSummary} /> : null}
          {tab === 'notes' ? <NotesTab clientId={clientId} onChanged={loadSummary} /> : null}
          {tab === 'timeline' ? <TimelineTab clientId={clientId} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

// ───────────── Özet ─────────────

function SummaryTab({ summary, onGo }: { summary: ClientFileSummary; onGo: (tab: Tab) => void }) {
  const a = summary.anamnesis;
  const f = summary.findings;
  return (
    <>
      <Card onPress={() => onGo('review')}>
        <Text variant="caption" tone="muted" style={{ fontWeight: '700', marginBottom: 6 }}>
          İNCELEME
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={`${f.red} incelenecek`} kind={f.red > 0 ? 'danger' : 'neutral'} />
          <Tag label={`${f.yellow} doğrulanacak`} kind={f.yellow > 0 ? 'warning' : 'neutral'} />
          <Tag label={`${f.green} öneri`} kind={f.green > 0 ? 'success' : 'neutral'} />
          {f.followUp > 0 ? <Tag label={`${f.followUp} takipte`} kind="info" /> : null}
        </View>
      </Card>

      {summary.profile ? (
        <Card variant="soft">
          <Text variant="bodyStrong">
            {summary.profile.ageYears} yaş · {summary.profile.gender === 'FEMALE' ? 'Kadın' : summary.profile.gender === 'MALE' ? 'Erkek' : 'Belirtilmemiş'}
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="Son ölçümler" action="Tümü" onAction={() => onGo('measurements')} />
      {summary.measurements.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {summary.measurements.map((m, i) => (
            <ListRow
              key={m.id}
              icon="analytics-outline"
              title={`${KIND_LABELS[m.kind]} · ${formatValue(m)}`}
              subtitle={`${formatFullDate(m.takenAt)} · ${METHOD_LABELS[m.method]} · ${SOURCE_LABELS[m.source]}`}
              last={i === summary.measurements.length - 1}
            />
          ))}
        </Card>
      ) : (
        <Text variant="caption" tone="muted">
          Görünür ölçüm yok.
        </Text>
      )}

      {a ? (
        <>
          <SectionHeader title="Sağlık öyküsü" action="Aç" onAction={() => onGo('anamnesis')} />
          <Card>
            <Text variant="bodyStrong">
              {a.answered} / {a.total} soru yanıtlandı
            </Text>
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={a.answered} max={a.total} />
            </View>
          </Card>
          <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 10 }}>
            {a.highlights.map((h, i) => (
              <ListRow
                key={h.key}
                title={h.text}
                subtitle={h.value === null ? 'Henüz yanıt yok · danışana sor' : answerText({ options: h.options, unit: null }, h.value)}
                trailing={h.value === null ? <Tag label="Eksik" kind="warning" /> : undefined}
                last={i === a.highlights.length - 1}
              />
            ))}
          </Card>
          {a.missing.length > 0 ? (
            <Notice kind="warning" title="Danışana sorulacaklar" text={`${a.missing.length} soru yanıtsız. Eksik bilgi varken kesin bir değerlendirme yapma; önce bu bilgileri doğrula.`} />
          ) : null}
        </>
      ) : null}

      <Notice kind="info" text="Bu ekran danışanın verdiği bilgileri gösterir; otomatik bir sağlık değerlendirmesi veya tanı içermez." />
    </>
  );
}

// ───────────── Ölçümler ─────────────

function MeasurementsTab({ clientId, visible, onChanged }: { clientId: string; visible: string[]; onChanged: () => void }) {
  const kinds = KIND_ORDER.filter((k) => (k === 'WEIGHT' ? visible.includes('WEIGHT') : visible.includes('MEASUREMENTS')));
  const [kind, setKind] = useState<MeasurementKind>(kinds[0] ?? 'WEIGHT');
  const [items, setItems] = useState<MeasurementItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<MeasurementItem | null>(null);

  const load = useCallback(async () => {
    if (kinds.length === 0) return setItems([]);
    try {
      setItems(await api.clientMeasurements(clientId, { kind, includeVoided: true }));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId, kind, kinds.length]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (kinds.length === 0) return <EmptyState icon="lock-closed-outline" title="Ölçümler paylaşılmıyor" text="Danışan kilo ve ölçü paylaşımını açarsa burada görünür." />;

  const valid = (items ?? []).filter((m) => !m.voided);
  const series = valid.slice(0, 8).reverse();

  const voidIt = async () => {
    if (!voidTarget) return;
    try {
      await api.voidClientMeasurement(clientId, voidTarget.id);
      showToast('Ölçüm geçersiz sayıldı', 'info');
      await load();
      onChanged();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      <ChipRow options={kinds.map((k) => ({ key: k, label: KIND_LABELS[k] }))} selected={[kind]} onToggle={setKind} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {series.length >= 2 ? (
        <Card>
          <BarChart values={series.map((m) => m.value)} labels={series.map((m) => formatShortDate(m.takenAt))} format={(v) => `${v.toLocaleString('tr-TR')} ${series[0]!.unit}`} />
        </Card>
      ) : null}
      {mixedMethods(series) ? (
        <Notice kind="warning" text="Bu seride farklı yöntemlerle ölçülmüş değerler var. Yöntemler arasında fark olabileceği için değerleri doğrudan karşılaştırırken dikkatli ol." />
      ) : null}
      <Button label="Ölçüm ekle" icon="add-circle-outline" variant="secondary" block onPress={() => setAddOpen(true)} style={{ marginBottom: 12 }} />
      {items && items.length === 0 ? <Text variant="caption" tone="muted">Bu tür için ölçüm yok.</Text> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((m, i) => (
            <ListRow
              key={m.id}
              icon={m.voided ? 'close-circle-outline' : 'analytics-outline'}
              title={`${formatValue(m)}${m.voided ? ' · geçersiz' : changeText(m, valid)}`}
              subtitle={`${formatFullDate(m.takenAt)} · ${METHOD_LABELS[m.method]}${m.deviceName ? ` (${m.deviceName})` : ''} · ${SOURCE_LABELS[m.source]}`}
              trailing={!m.voided && m.source === 'PROFESSIONAL' ? <Button label="Geçersiz say" variant="ghost" size="sm" onPress={() => setVoidTarget(m)} /> : undefined}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      ) : null}
      <MeasurementSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        allowedKinds={kinds}
        defaultKind={kind}
        title="Danışan için ölçüm ekle"
        onSubmit={async (input) => {
          await api.addClientMeasurement(clientId, input);
          showToast('Ölçüm eklendi');
          setKind(input.kind);
          await load();
          onChanged();
        }}
      />
      <ConfirmSheet
        visible={voidTarget !== null}
        title="Ölçümü geçersiz say"
        text="Sadece kendi girdiğin ölçümü geçersiz sayabilirsin. Kayıt silinmez, geçmişte kalır."
        confirmLabel="Geçersiz say"
        danger
        onConfirm={voidIt}
        onClose={() => setVoidTarget(null)}
      />
    </>
  );
}

// ───────────── Anamnez ─────────────

function AnamnesisTab({ clientId, canView, onChanged }: { clientId: string; canView: boolean; onChanged: () => void }) {
  const [data, setData] = useState<AnamnesisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<IntakeQuestionView | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<IntakeQuestionType>('TEXT');
  const [qOptions, setQOptions] = useState('');
  const [qError, setQError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    try {
      setData(await api.clientAnamnesis(clientId));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId, canView]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!canView) return <EmptyState icon="lock-closed-outline" title="Sağlık öyküsü paylaşılmıyor" text="Danışan sağlık öyküsü paylaşımını açarsa burada görünür." />;

  const sections = (data?.questions ?? []).reduce<{ label: string; items: IntakeQuestionView[] }[]>((acc, q) => {
    const last = acc[acc.length - 1];
    if (last && last.label === q.sectionLabel) last.items.push(q);
    else acc.push({ label: q.sectionLabel, items: [q] });
    return acc;
  }, []);

  const addQuestion = async () => {
    setQError(null);
    try {
      await api.addIntakeQuestion({
        text: qText.trim(),
        type: qType,
        options: qOptions.split(',').map((o) => o.trim()).filter(Boolean),
      });
      setAddOpen(false);
      setQText('');
      setQOptions('');
      showToast('Soru eklendi. Danışanların bu soruyu görecek.');
      await load();
    } catch (e) {
      setQError(errorText(e));
    }
  };

  return (
    <>
      {error ? <Notice kind="danger" text={error} /> : null}
      <Notice kind="warning" text="Bu soru seti taslaktır; bir uzman tarafından henüz gözden geçirilmemiştir. Kendi sorularını ekleyebilirsin." />
      {sections.map((section) => (
        <View key={section.label}>
          <SectionHeader title={section.label} />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {section.items.map((q, i) => (
              <ListRow
                key={q.key}
                title={q.text}
                subtitle={
                  q.answer
                    ? `${answerText(q, q.answer.value)}\n${q.answer.source === 'PROFESSIONAL' ? 'Uzman girdi' : 'Danışan beyan etti'} · ${formatDateTime(q.answer.answeredAt)}`
                    : 'Yanıtlanmadı · danışana sor'
                }
                trailing={q.important && !q.answer ? <Tag label="Önemli" kind="warning" /> : undefined}
                onPress={() => setAnswering(q)}
                last={i === section.items.length - 1}
              />
            ))}
          </Card>
        </View>
      ))}
      <Button label="Kendi sorunu ekle" icon="add-circle-outline" variant="secondary" block onPress={() => setAddOpen(true)} style={{ marginTop: 16 }} />

      <AnswerSheet
        question={answering}
        onClose={() => setAnswering(null)}
        onSave={async (key, value) => {
          await api.answerClientAnamnesis(clientId, key, value);
          showToast('Yanıt kaydedildi (uzman girişi olarak işaretlendi)');
          await load();
          onChanged();
        }}
      />

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Yeni soru">
        {qError ? <Notice kind="warning" text={qError} /> : null}
        <TextField label="Soru" value={qText} onChangeText={setQText} multiline maxLength={200} />
        <ChipRow wrap options={QUESTION_TYPES} selected={[qType]} onToggle={setQType} />
        {qType === 'SINGLE_CHOICE' || qType === 'MULTI_CHOICE' ? (
          <TextField label="Seçenekler" value={qOptions} onChangeText={setQOptions} hint="Virgülle ayır: Düzenli, Düzensiz" />
        ) : null}
        <Button label="Soruyu ekle" size="lg" block onPress={addQuestion} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </>
  );
}

// ───────────── Notlar ─────────────

function NotesTab({ clientId, onChanged }: { clientId: string; onChanged: () => void }) {
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await api.clientNotes(clientId));
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const add = async () => {
    if (!text.trim()) return;
    try {
      await api.addClientNote(clientId, text);
      setText('');
      setError(null);
      await load();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <>
      <Notice kind="info" text="Görüşme notlarını sadece sen görürsün; danışana gösterilmez." />
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Yeni not" value={text} onChangeText={setText} multiline maxLength={2000} />
      <Button label="Notu ekle" block onPress={add} style={{ marginBottom: 12 }} />
      {notes?.map((n) => (
        <Card key={n.id} style={{ marginBottom: 10 }}>
          <Text variant="body">{n.text}</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
            {formatDateTime(n.createdAt)}
          </Text>
        </Card>
      ))}
      {notes && notes.length === 0 ? <Text variant="caption" tone="muted">Henüz not yok.</Text> : null}
    </>
  );
}

// ───────────── Zaman çizelgesi ─────────────

function TimelineTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .clientTimeline(clientId, { limit: 50 })
        .then((list) => {
          setItems(list);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, [clientId]),
  );

  return (
    <>
      {error ? <Notice kind="danger" text={error} /> : null}
      {items && items.length === 0 ? <EmptyState icon="time-outline" title="Henüz kayıt yok" /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((item, i) => {
            const key = `${item.type}-${item.id}`;
            const base = { last: i === items.length - 1 };
            if (item.type === 'MEASUREMENT') {
              return (
                <ListRow
                  key={key}
                  {...base}
                  icon="analytics-outline"
                  title={`${KIND_LABELS[item.kind]}: ${item.value.toLocaleString('tr-TR')} ${item.unit}${item.voided ? ' (geçersiz)' : ''}`}
                  subtitle={`${formatDateTime(item.at)} · ${METHOD_LABELS[item.method]} · ${SOURCE_LABELS[item.source]}`}
                />
              );
            }
            if (item.type === 'ANSWER') {
              return (
                <ListRow
                  key={key}
                  {...base}
                  icon="clipboard-outline"
                  title={item.question}
                  subtitle={`${item.display}\n${item.source === 'PROFESSIONAL' ? 'Uzman girdi' : 'Danışan beyan etti'} · ${formatDateTime(item.at)}`}
                />
              );
            }
            if (item.type === 'APPOINTMENT') {
              return (
                <ListRow
                  key={key}
                  {...base}
                  icon="calendar-outline"
                  title={`Randevu · ${STATUS_TAGS[item.status].label}${item.title ? ` · ${item.title}` : ''}`}
                  subtitle={`${formatDateTime(item.at)} · ${MODE_LABELS[item.mode]}${item.outcome ? `\nÖzet: ${item.outcome}` : ''}`}
                />
              );
            }
            return <ListRow key={key} {...base} icon="document-text-outline" title="Görüşme notu" subtitle={`${item.text}\n${formatDateTime(item.at)}`} />;
          })}
        </Card>
      ) : null}
    </>
  );
}
