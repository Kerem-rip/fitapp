// Plan editörü (diyetisyen): taslak hazırla → kontrol et → onayla ve yayınla.
// Taslak danışana görünmez. Onaylanan sürüm değiştirilmez; sonraki değişiklik yeni taslakla yapılır.
import type { PlanCheck, PlanContent, PlanMeal, PlanOption } from '@fitapp/api-client';
import type { DietPreference } from '@fitapp/shared';
import { BottomSheet, Button, Card, IconButton, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Stepper, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { allergenText, cleanContent, localId, sampleStarter } from '@/features/plans/helpers';
import { OptionSheet } from '@/features/plans/OptionSheet';

type Editing = { mealId: string; option: PlanOption } | null;

export default function PlanEditorScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [loaded, setLoaded] = useState(false);
  const [hasPublished, setHasPublished] = useState(false);
  const [content, setContent] = useState<PlanContent | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [check, setCheck] = useState<PlanCheck | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const overview = await api.clientPlan(clientId);
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

  // Örnek menü: danışanın beyan ettiği alerjen ve tercihe göre filtrelenir (sağlık öyküsü paylaşılıyorsa)
  const startFromSample = () =>
    run(async () => {
      let allergens: string[] = [];
      let diet: DietPreference = 'none';
      try {
        const anamnesis = await api.clientAnamnesis(clientId);
        const a = anamnesis.questions.find((q) => q.key === 'std.allergies')?.answer?.value;
        const d = anamnesis.questions.find((q) => q.key === 'std.diet_preference')?.answer?.value;
        if (Array.isArray(a)) allergens = a.filter((x) => x !== 'none');
        if (d === 'vegetarian' || d === 'vegan') diet = d;
      } catch {
        // Paylaşılmıyorsa filtre uygulanamaz; onay zaten alerji bilgisi olmadan yapılamaz
      }
      const created = await api.createPlanDraft(clientId, { content: cleanContent(sampleStarter(allergens, diet)) });
      setContent(created.content);
      showToast('Örnek menüden taslak oluşturuldu; seçenekleri kontrol et');
    });

  const start = (fromPublished: boolean) =>
    run(async () => {
      const created = await api.createPlanDraft(clientId, { fromPublished });
      setContent(created.content);
    });

  const save = async () => {
    if (!content) return;
    const saved = await api.savePlanDraft(clientId, cleanContent(content), changeNote);
    setContent(saved.content);
    setDirty(false);
  };

  const doCheck = () =>
    run(async () => {
      await save();
      setCheck(await api.checkPlanDraft(clientId));
    });

  const approve = () =>
    run(async () => {
      await save();
      const result = await api.checkPlanDraft(clientId);
      setCheck(result);
      if (!result.canApprove) return;
      if (result.warnings.length > 0) return setConfirmOpen(true);
      await finalize(false);
    });

  const finalize = async (confirmWarnings: boolean) => {
    const res = await api.approvePlanDraft(clientId, { changeNote: changeNote.trim() || undefined, confirmWarnings });
    showToast(`Sürüm ${res.number} danışana yayınlandı`);
    // Editör doğrudan açıldıysa geri gidilecek sayfa olmayabilir
    if (router.canGoBack()) router.back();
    else router.replace(`/client-file/${clientId}`);
  };

  const update = (fn: (c: PlanContent) => PlanContent) => {
    setContent((cur) => (cur ? fn(cur) : cur));
    setDirty(true);
    setCheck(null);
  };
  const updateMeal = (id: string, fn: (m: PlanMeal) => PlanMeal) => update((c) => ({ ...c, meals: c.meals.map((m) => (m.id === id ? fn(m) : m)) }));

  if (!loaded) return <Screen><ScreenHeader title="Plan" onBack={() => router.back()} /></Screen>;

  if (!content) {
    return (
      <Screen>
        <ScreenHeader title="Plan taslağı" subtitle="Sen onaylamadan danışan görmez" onBack={() => router.back()} />
        {error ? <Notice kind="danger" text={error} /> : null}
        <Notice kind="info" text="Taslak danışana görünmez. Kontrol edip onayladığında danışana yayınlanır ve sürüm numarası alır." />
        <View style={{ gap: 10 }}>
          {hasPublished ? <Button label="Yayındaki sürümden başla" size="lg" block disabled={busy} onPress={() => start(true)} /> : null}
          <Button label="Örnek menüden başla" variant="secondary" size="lg" block disabled={busy} onPress={startFromSample} />
          <Button label="Boş taslak" variant="ghost" block disabled={busy} onPress={() => start(false)} />
        </View>
        <Text variant="micro" tone="muted" style={{ marginTop: 10 }}>
          Örnek menü, danışanın beyan ettiği alerjen ve beslenme tercihine göre filtrelenen örnek yiyeceklerden oluşur. Değerler tahminidir; her seçeneği kontrol et.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Plan taslağı" subtitle={dirty ? 'Kaydedilmemiş değişiklik var' : 'Kaydedildi'} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <Card>
        <TextField label="Başlık" value={content.title ?? ''} onChangeText={(t) => update((c) => ({ ...c, title: t }))} maxLength={80} />
        <TextField
          label="Hedef kalori (isteğe bağlı, senin belirlediğin)"
          value={content.targetKcal !== undefined ? String(content.targetKcal) : ''}
          onChangeText={(t) => update((c) => ({ ...c, targetKcal: t.trim() ? Number(t.replace(',', '.')) : undefined }))}
          keyboardType="decimal-pad"
        />
        <TextField label="Danışana genel notlar" value={content.notes ?? ''} onChangeText={(t) => update((c) => ({ ...c, notes: t }))} multiline maxLength={1000} />
      </Card>

      {content.meals.map((meal, mi) => (
        <View key={meal.id}>
          <SectionHeader title={`${mi + 1}. öğün`} />
          <Card>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <TextField label="Öğün adı" value={meal.name} onChangeText={(t) => updateMeal(meal.id!, (m) => ({ ...m, name: t }))} maxLength={40} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Saat" value={meal.time ?? ''} onChangeText={(t) => updateMeal(meal.id!, (m) => ({ ...m, time: t }))} placeholder="08:00" />
              </View>
            </View>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
              Danışan kaç seçenek seçer?
            </Text>
            <Stepper value={meal.pick} onChange={(v) => updateMeal(meal.id!, (m) => ({ ...m, pick: v }))} min={1} max={5} step={1} format={(v) => `${v}`} />
            <TextField label="Değiştirme kuralı (isteğe bağlı)" value={meal.rule ?? ''} onChangeText={(t) => updateMeal(meal.id!, (m) => ({ ...m, rule: t }))} maxLength={300} />

            <Text variant="caption" tone="secondary" style={{ marginTop: 4, marginBottom: 4, fontWeight: '600' }}>
              Alternatifler ({meal.options.length})
            </Text>
            {meal.options.map((o, oi) => (
              <ListRow
                key={o.id}
                title={`${o.name} · ${o.portion}`}
                subtitle={`${o.kcal !== undefined ? `${o.kcal} kcal · ` : ''}${allergenText(o.allergens)}`}
                trailing={<IconButton icon="trash-outline" label="Seçeneği sil" size={34} onPress={() => updateMeal(meal.id!, (m) => ({ ...m, options: m.options.filter((x) => x.id !== o.id) }))} />}
                onPress={() => setEditing({ mealId: meal.id!, option: o })}
                last={oi === meal.options.length - 1}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button label="Seçenek ekle" icon="add" variant="secondary" size="sm" onPress={() => setEditing({ mealId: meal.id!, option: { name: '', portion: '', allergens: [] } })} />
              <Button label="Öğünü sil" variant="ghost" size="sm" onPress={() => update((c) => ({ ...c, meals: c.meals.filter((m) => m.id !== meal.id) }))} />
            </View>
          </Card>
        </View>
      ))}

      <Button
        label="Öğün ekle"
        icon="add-circle-outline"
        variant="secondary"
        block
        onPress={() => update((c) => ({ ...c, meals: [...c.meals, { id: localId(), name: 'Yeni öğün', pick: 1, options: [] }] }))}
        style={{ marginTop: 12 }}
      />

      <SectionHeader title="Yayınlama" />
      <TextField label="Bu sürümde ne değişti? (isteğe bağlı)" value={changeNote} onChangeText={(t) => { setChangeNote(t); setDirty(true); }} maxLength={300} />
      {check ? (
        <>
          {check.blockers.length > 0 ? (
            <Notice kind="danger" title="Onaylanamaz" text={check.blockers.map((b) => `• ${b.message}`).join('\n')} />
          ) : (
            <Notice kind="success" text="Engel yok. Onaylarsan plan danışana yayınlanır." />
          )}
          {check.warnings.length > 0 ? (
            <Notice kind="warning" title="Değerlendirmen gereken maddeler" text={check.warnings.map((w) => `• ${w.title}`).join('\n')} />
          ) : null}
        </>
      ) : null}
      <View style={{ gap: 10 }}>
        <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} variant="secondary" block disabled={busy || !dirty} onPress={() => run(save)} />
        <Button label="Kontrol et" variant="secondary" block disabled={busy} onPress={doCheck} />
        <Button label="Onayla ve danışana yayınla" size="lg" block icon="checkmark-circle-outline" disabled={busy} onPress={approve} />
        <Button label="Taslağı sil" variant="ghost" block onPress={() => setDiscardOpen(true)} />
      </View>

      <OptionSheet
        option={editing?.option ?? null}
        onClose={() => setEditing(null)}
        onSave={(option) => {
          const mealId = editing!.mealId;
          updateMeal(mealId, (m) => ({
            ...m,
            options: m.options.some((o) => o.id === option.id) ? m.options.map((o) => (o.id === option.id ? option : o)) : [...m.options, option],
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
          <Button
            label="Değerlendirdim, yayınla"
            size="lg"
            block
            onPress={() => {
              setConfirmOpen(false);
              void run(() => finalize(true));
            }}
          />
          <Button label="Vazgeç" variant="ghost" block onPress={() => setConfirmOpen(false)} />
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={discardOpen}
        title="Taslağı sil"
        text="Kaydedilmemiş ve kaydedilmiş tüm taslak değişiklikleri silinir. Yayındaki sürüm etkilenmez."
        confirmLabel="Sil"
        danger
        onConfirm={() =>
          run(async () => {
            await api.discardPlanDraft(clientId);
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
