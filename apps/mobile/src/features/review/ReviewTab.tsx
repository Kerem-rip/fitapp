// Danışan dosyasının "İnceleme" sekmesi: kırmızı / sarı / yeşil maddeler.
// Maddeler otomatik tutarlılık kontrolleridir; tanı ya da tedavi önerisi değildir. Karar uzmandadır:
// her maddeye not ekler, gerekçesiyle kapatır ya da takip görevine çevirir.
import type { FindingDecision, FindingItem, FindingLevel, FindingsResponse, ReviewTask } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, Notice, SectionHeader, Segmented, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { formatDateTime } from '@/features/sharing/labels';
import { DECISION_LABELS, DECISION_ORDER, dueLabel, eventText, LEVEL_TAGS, LEVEL_TITLES, parseDueInput } from './labels';

type Sheet = { kind: 'note' | 'task' | 'close'; finding: FindingItem } | { kind: 'ownTask' } | null;

export function ReviewTab({ clientId, onChanged }: { clientId: string; onChanged: () => void }) {
  const [view, setView] = useState<'open' | 'closed'>('open');
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [decision, setDecision] = useState<FindingDecision>('EVALUATED');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [findings, open] = await Promise.all([api.clientFindings(clientId, view), api.clientTasks(clientId)]);
      setData(findings);
      setTasks(open);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId, view]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    await load();
    onChanged();
  };

  const openSheet = (next: NonNullable<Sheet>) => {
    setSheet(next);
    setText(next.kind === 'task' ? `${next.finding.title} · takip` : '');
    setDue('');
    setDecision('EVALUATED');
    setSheetError(null);
  };

  const submit = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    setSheetError(null);
    try {
      if (sheet.kind === 'note') {
        await api.addFindingNote(clientId, sheet.finding.id, text);
        showToast('Not eklendi');
      } else if (sheet.kind === 'close') {
        await api.closeFinding(clientId, sheet.finding.id, decision, text);
        showToast('Madde kapatıldı', 'info');
      } else {
        const dueAt = parseDueInput(due);
        if (dueAt === null) throw new Error('Tarihi GG.AA.YYYY biçiminde yaz (bugün ya da ileri bir tarih) ya da boş bırak.');
        if (sheet.kind === 'task') await api.createFindingTask(clientId, sheet.finding.id, { title: text, dueAt });
        else await api.addClientTask(clientId, { title: text, dueAt });
        showToast('Takip görevi eklendi');
      }
      setSheet(null);
      await refresh();
    } catch (e) {
      setSheetError(e instanceof Error && !('code' in e) ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      showToast(done, 'info');
      await refresh();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const groups = (['RED', 'YELLOW', 'GREEN'] as FindingLevel[]).map((level) => ({ level, items: (data?.items ?? []).filter((f) => f.level === level) }));

  return (
    <>
      <Notice
        kind="info"
        title="Otomatik tutarlılık kontrolleri"
        text="Bu maddeler danışanın verdiği bilgilerden otomatik çıkarılır; tanı veya tedavi önerisi değildir. Kural seti henüz bir uzman tarafından gözden geçirilmedi. Kararı her zaman sen verirsin."
      />
      {error ? <Notice kind="danger" text={error} /> : null}
      <Segmented
        options={[
          { key: 'open', label: 'Açık' },
          { key: 'closed', label: 'Kapatılanlar' },
        ]}
        value={view}
        onChange={(v) => {
          setData(null);
          setView(v);
        }}
      />

      {data && data.items.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title={view === 'open' ? 'Açık madde yok' : 'Kapatılmış madde yok'} />
      ) : null}

      {view === 'open'
        ? groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <View key={g.level}>
                <SectionHeader title={`${LEVEL_TITLES[g.level]} (${g.items.length})`} />
                {g.items.map((f) => (
                  <FindingCard key={f.id} finding={f} onSheet={(kind) => openSheet({ kind, finding: f })} />
                ))}
              </View>
            ))
        : data?.items.map((f) => (
            <Card key={f.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <Tag label={LEVEL_TAGS[f.level].label} kind={LEVEL_TAGS[f.level].kind} />
                {f.decision ? <Tag label={DECISION_LABELS[f.decision]} kind="neutral" /> : null}
              </View>
              <Text variant="bodyStrong">{f.title}</Text>
              {f.closedReason ? (
                <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                  Gerekçe: {f.closedReason}
                </Text>
              ) : null}
              <Button label="Yeniden aç" variant="secondary" size="sm" onPress={() => act(() => api.reopenFinding(clientId, f.id), 'Madde yeniden açıldı')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </Card>
          ))}

      {view === 'open' ? (
        <>
          <SectionHeader title={`Takip görevleri (${tasks.length})`} />
          {tasks.map((t) => {
            const d = dueLabel(t.dueAt);
            return (
              <Card key={t.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{t.title}</Text>
                    <Text variant="caption" tone={d.overdue ? 'danger' : 'muted'}>
                      {d.text}
                    </Text>
                  </View>
                  <Button label="Tamamla" size="sm" variant="secondary" onPress={() => act(() => api.completeTask(t.id), 'Görev tamamlandı')} />
                </View>
              </Card>
            );
          })}
          <Button label="Görev ekle" icon="add-circle-outline" variant="secondary" block onPress={() => openSheet({ kind: 'ownTask' })} />
        </>
      ) : null}

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'note' ? 'Not ekle' : sheet?.kind === 'close' ? 'Maddeyi kapat' : 'Takip görevi'}
      >
        {sheet ? (
          <>
            {sheetError ? <Notice kind="warning" text={sheetError} /> : null}
            {sheet.kind === 'close' ? (
              <>
                <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
                  Kararın
                </Text>
                <ChipRow wrap options={DECISION_ORDER.map((d) => ({ key: d, label: DECISION_LABELS[d] }))} selected={[decision]} onToggle={setDecision} />
              </>
            ) : null}
            <TextField
              label={sheet.kind === 'note' ? 'Not' : sheet.kind === 'close' ? 'Gerekçen' : 'Görev'}
              value={text}
              onChangeText={setText}
              multiline={sheet.kind !== 'ownTask' && sheet.kind !== 'task'}
              maxLength={sheet.kind === 'note' ? 1000 : 500}
            />
            {sheet.kind === 'task' || sheet.kind === 'ownTask' ? (
              <TextField label="Vade (isteğe bağlı)" value={due} onChangeText={setDue} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" />
            ) : null}
            <Button
              label={busy ? 'Kaydediliyor...' : sheet.kind === 'close' ? 'Kapat' : 'Kaydet'}
              size="lg"
              block
              disabled={busy}
              onPress={submit}
              style={{ marginBottom: 8 }}
            />
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

function FindingCard({ finding: f, onSheet }: { finding: FindingItem; onSheet: (kind: 'note' | 'task' | 'close') => void }) {
  const tag = LEVEL_TAGS[f.level];
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <Tag label={tag.label} kind={tag.kind} />
        {f.status === 'FOLLOW_UP' ? <Tag label="Takipte" kind="info" icon="time-outline" /> : null}
      </View>
      <Text variant="heading">{f.title}</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
        {f.detail}
      </Text>

      <Text variant="caption" tone="muted" style={{ marginTop: 10, fontWeight: '700' }}>
        DAYANAK
      </Text>
      {f.basis.map((b, i) => (
        <Text key={i} variant="caption" tone="secondary">
          • {b.label}: {b.display}
        </Text>
      ))}

      {f.tasks.filter((t) => t.status === 'OPEN').map((t) => (
        <Text key={t.id} variant="caption" tone="accent" style={{ marginTop: 6 }}>
          Görev: {t.title} ({dueLabel(t.dueAt).text})
        </Text>
      ))}
      {f.events.length > 0 ? (
        <View style={{ marginTop: 8, gap: 2 }}>
          {f.events.map((e) => (
            <Text key={e.id} variant="micro" tone="muted">
              {formatDateTime(e.createdAt)} · {eventText(e)}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button label="Not ekle" variant="secondary" size="sm" icon="create-outline" onPress={() => onSheet('note')} />
        <Button label="Görev yap" variant="secondary" size="sm" icon="alarm-outline" onPress={() => onSheet('task')} />
        <Button label="Kapat" size="sm" icon="checkmark-circle-outline" onPress={() => onSheet('close')} />
      </View>
    </Card>
  );
}
