// Program editörü (antrenör): taslak hazırla → kontrol et → onayla ve yayınla.
// Taslak danışana görünmez. Onaylanan sürüm değiştirilmez; sonraki değişiklik yeni taslakla yapılır.
import type { ProgramCheck, ProgramContent, ProgramDay, ProgramExercise } from '@fitapp/api-client';
import { BottomSheet, Button, Card, IconButton, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { localId } from '@/features/plans/helpers';
import { ExerciseSheet } from '@/features/programs/ExerciseSheet';

type Editing = { dayId: string; exercise: ProgramExercise } | null;

// Sunucuya gidecek içerik: boş alanlar atılır
function clean(content: ProgramContent): ProgramContent {
  return {
    ...(content.title?.trim() ? { title: content.title.trim() } : {}),
    ...(content.goal?.trim() ? { goal: content.goal.trim() } : {}),
    ...(content.notes?.trim() ? { notes: content.notes.trim() } : {}),
    ...(content.weeks !== undefined && !Number.isNaN(content.weeks) ? { weeks: content.weeks } : {}),
    days: content.days.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      ...(d.focus?.trim() ? { focus: d.focus.trim() } : {}),
      exercises: d.exercises,
    })),
  };
}

export default function ProgramEditorScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [loaded, setLoaded] = useState(false);
  const [hasPublished, setHasPublished] = useState(false);
  const [content, setContent] = useState<ProgramContent | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [check, setCheck] = useState<ProgramCheck | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const overview = await api.clientProgram(clientId);
      setHasPublished(overview.published !== null);
      setContent(overview.draft ? overview.draft.content : null);
      setChangeNote(overview.draft?.changeNote ?? '');
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoaded(true);
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const start = (fromPublished: boolean) =>
    run(async () => {
      const created = await api.createProgramDraft(clientId, fromPublished ? { fromPublished } : { content: { title: 'Antrenman programı', days: [] } });
      setContent(created.content);
    });

  const save = async () => {
    if (!content) return;
    const saved = await api.saveProgramDraft(clientId, clean(content), changeNote);
    setContent(saved.content);
    setDirty(false);
  };

  const finalize = async (confirmWarnings: boolean) => {
    const res = await api.approveProgramDraft(clientId, { changeNote: changeNote.trim() || undefined, confirmWarnings });
    showToast(`Sürüm ${res.number} danışana yayınlandı`);
    if (router.canGoBack()) router.back();
    else router.replace(`/client-file/${clientId}`);
  };

  const approve = () =>
    run(async () => {
      await save();
      const result = await api.checkProgramDraft(clientId);
      setCheck(result);
      if (!result.canApprove) return;
      if (result.warnings.length > 0) return setConfirmOpen(true);
      await finalize(false);
    });

  const update = (fn: (c: ProgramContent) => ProgramContent) => {
    setContent((cur) => (cur ? fn(cur) : cur));
    setDirty(true);
    setCheck(null);
  };
  const updateDay = (id: string, fn: (d: ProgramDay) => ProgramDay) => update((c) => ({ ...c, days: c.days.map((d) => (d.id === id ? fn(d) : d)) }));

  if (!loaded) return <Screen><ScreenHeader title="Program" onBack={() => router.back()} /></Screen>;

  if (!content) {
    return (
      <Screen>
        <ScreenHeader title="Program taslağı" subtitle="Sen onaylamadan danışan görmez" onBack={() => router.back()} />
        {error ? <Notice kind="danger" text={error} /> : null}
        <Notice kind="info" text="Taslak danışana görünmez. Kontrol edip onayladığında danışana yayınlanır ve sürüm numarası alır." />
        <View style={{ gap: 10 }}>
          {hasPublished ? <Button label="Yayındaki sürümden başla" size="lg" block disabled={busy} onPress={() => start(true)} /> : null}
          <Button label="Boş program" variant="secondary" size="lg" block disabled={busy} onPress={() => start(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Program taslağı" subtitle={dirty ? 'Kaydedilmemiş değişiklik var' : 'Kaydedildi'} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <Card>
        <TextField label="Başlık" value={content.title ?? ''} onChangeText={(t) => update((c) => ({ ...c, title: t }))} maxLength={80} />
        <TextField label="Programın hedefi (isteğe bağlı)" value={content.goal ?? ''} onChangeText={(t) => update((c) => ({ ...c, goal: t }))} maxLength={120} />
        <TextField
          label="Süre (hafta, isteğe bağlı)"
          value={content.weeks !== undefined ? String(content.weeks) : ''}
          onChangeText={(t) => update((c) => ({ ...c, weeks: t.trim() ? Number(t) : undefined }))}
          keyboardType="number-pad"
        />
        <TextField label="Danışana genel notlar" value={content.notes ?? ''} onChangeText={(t) => update((c) => ({ ...c, notes: t }))} multiline maxLength={1000} />
      </Card>

      {content.days.map((day, di) => (
        <View key={day.id}>
          <SectionHeader title={`${di + 1}. gün`} />
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <TextField label="Gün adı" value={day.name} onChangeText={(t) => updateDay(day.id!, (d) => ({ ...d, name: t }))} maxLength={40} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Odak" value={day.focus ?? ''} onChangeText={(t) => updateDay(day.id!, (d) => ({ ...d, focus: t }))} placeholder="Alt vücut" maxLength={60} />
              </View>
            </View>
            {day.exercises.map((e, ei) => (
              <ListRow
                key={e.id}
                title={`${ei + 1}. ${e.name}`}
                subtitle={`${e.sets} × ${e.reps}${e.load ? ` · ${e.load}` : ''}${e.restSec !== undefined ? ` · ${e.restSec} sn dinlenme` : ''}`}
                trailing={<IconButton icon="trash-outline" label="Egzersizi sil" size={34} onPress={() => updateDay(day.id!, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) }))} />}
                onPress={() => setEditing({ dayId: day.id!, exercise: e })}
                last={ei === day.exercises.length - 1}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button label="Egzersiz ekle" icon="add" variant="secondary" size="sm" onPress={() => setEditing({ dayId: day.id!, exercise: { name: '', sets: 3, reps: '' } })} />
              <Button label="Günü sil" variant="ghost" size="sm" onPress={() => update((c) => ({ ...c, days: c.days.filter((d) => d.id !== day.id) }))} />
            </View>
          </Card>
        </View>
      ))}

      <Button
        label="Gün ekle"
        icon="add-circle-outline"
        variant="secondary"
        block
        onPress={() => update((c) => ({ ...c, days: [...c.days, { id: localId(), name: `${String.fromCharCode(65 + c.days.length)} günü`, exercises: [] }] }))}
        style={{ marginTop: 12 }}
      />

      <SectionHeader title="Yayınlama" />
      <TextField label="Bu sürümde ne değişti? (isteğe bağlı)" value={changeNote} onChangeText={(t) => { setChangeNote(t); setDirty(true); }} maxLength={300} />
      {check ? (
        <>
          {check.blockers.length > 0 ? (
            <Notice kind="danger" title="Onaylanamaz" text={check.blockers.map((b) => `• ${b.message}`).join('\n')} />
          ) : (
            <Notice kind="success" text="Engel yok. Onaylarsan program danışana yayınlanır." />
          )}
          {check.warnings.length > 0 ? <Notice kind="warning" title="Değerlendirmen gereken maddeler" text={check.warnings.map((w) => `• ${w.title}`).join('\n')} /> : null}
        </>
      ) : null}
      <View style={{ gap: 10 }}>
        <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} variant="secondary" block disabled={busy || !dirty} onPress={() => run(save)} />
        <Button label="Kontrol et" variant="secondary" block disabled={busy} onPress={() => run(async () => { await save(); setCheck(await api.checkProgramDraft(clientId)); })} />
        <Button label="Onayla ve danışana yayınla" size="lg" block icon="checkmark-circle-outline" disabled={busy} onPress={approve} />
        <Button label="Taslağı sil" variant="ghost" block onPress={() => setDiscardOpen(true)} />
      </View>

      <ExerciseSheet
        exercise={editing?.exercise ?? null}
        onClose={() => setEditing(null)}
        onSave={(exercise) => {
          const dayId = editing!.dayId;
          updateDay(dayId, (d) => ({
            ...d,
            exercises: d.exercises.some((x) => x.id === exercise.id) ? d.exercises.map((x) => (x.id === exercise.id ? exercise : x)) : [...d.exercises, exercise],
          }));
        }}
      />

      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Uyarıları değerlendirdin mi?">
        <Text variant="body" tone="secondary" style={{ marginBottom: 10 }}>
          Bu danışan için açık maddeler var. Onaylarsan bu maddeleri değerlendirdiğin kayda geçer.
        </Text>
        {check?.warnings.map((w) => (
          <Text key={w.title} variant="caption" style={{ marginBottom: 4 }}>
            • {w.title}
          </Text>
        ))}
        <View style={{ gap: 10, marginTop: 14, marginBottom: 8 }}>
          <Button label="Değerlendirdim, yayınla" size="lg" block onPress={() => { setConfirmOpen(false); void run(() => finalize(true)); }} />
          <Button label="Vazgeç" variant="ghost" block onPress={() => setConfirmOpen(false)} />
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={discardOpen}
        title="Taslağı sil"
        text="Taslaktaki değişiklikler silinir. Yayındaki sürüm etkilenmez."
        confirmLabel="Sil"
        danger
        onConfirm={() =>
          run(async () => {
            await api.discardProgramDraft(clientId);
            setContent(null);
            setCheck(null);
            showToast('Taslak silindi', 'info');
          })
        }
        onClose={() => setDiscardOpen(false)}
      />
    </Screen>
  );
}
