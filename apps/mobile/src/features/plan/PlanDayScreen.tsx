// Günlük program: hareketler sırayla (ısınma → ana çalışma → soğuma). Her hareket için set/tekrar, süre ve dinlenme zamanlayıcısı,
// tamamlandı / atlandı, zorlanma ve ağrı geri bildirimi, uygun alternatif hareket. Ağrıda güvenlik uyarısı önceliklidir.
import type { PlanBodyArea, PlanDayView, PlanEntryView } from '@fitapp/api-client';
import { BottomSheet, Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatLong } from '@/demo/dates';
import { AREA_LABELS, SECTION_LABELS, SOURCE_TAG } from './labels';
import { RestTimer } from './RestTimer';

const RPE = Array.from({ length: 10 }, (_, i) => ({ key: String(i + 1), label: String(i + 1) }));
const rpeHint = (n: number) => (n >= 10 ? 'Son güç' : n >= 9 ? 'Çok zor' : n >= 7 ? 'Zor' : n >= 5 ? 'Orta' : n >= 3 ? 'Kolay' : 'Çok kolay');

export function PlanDayScreen() {
  const router = useRouter();
  const { instanceId, day } = useLocalSearchParams<{ instanceId: string; day: string }>();
  const dayNumber = Number(day);
  const [data, setData] = useState<PlanDayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PlanEntryView | null>(null);
  const [alt, setAlt] = useState<PlanEntryView | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [rpe, setRpe] = useState('6');
  const [pain, setPain] = useState(false);
  const [area, setArea] = useState<PlanBodyArea | null>(null);
  const [sharp, setSharp] = useState(false);
  const [safety, setSafety] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .planDay(instanceId, dayNumber)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [instanceId, dayNumber]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  // Gelmemiş günün hareketi işaretlenemez (sunucu da denetler); geçmiş günün hareketi değiştirilemez
  const canLog = data ? data.date <= dateKey(0) : false;
  const canSwap = data ? data.date >= dateKey(0) : false;

  const openDone = (e: PlanEntryView) => {
    setRpe(String(e.log?.rpe ?? 6));
    setPain(Boolean(e.log?.pain));
    setArea(e.log?.painArea ?? null);
    setSharp(Boolean(e.log?.painSharp));
    setDone(e);
  };
  const send = async (e: PlanEntryView, status: 'DONE' | 'SKIPPED') => {
    try {
      const r = await api.planLogEntry(instanceId, dayNumber, e.index, status === 'DONE' ? { status, rpe: Number(rpe), pain: pain || area !== null || sharp, painArea: area, painSharp: sharp } : { status });
      setDone(null);
      if (r.safety) setSafety(r.seeProfessional ? `${r.safety} Keskin ağrı bildirdin; bir doktora ya da uzmana başvurmanı öneririz.` : r.safety);
      else showToast(status === 'DONE' ? 'Tamamlandı' : 'Atlandı');
      load();
    } catch (err) {
      showToast(errorText(err), 'warning');
    }
  };
  const swap = async (e: PlanEntryView, itemId: string) => {
    try {
      setData(await api.planSwapEntry(instanceId, dayNumber, e.index, itemId));
      setAlt(null);
      showToast('Hareket değiştirildi');
    } catch (err) {
      showToast(errorText(err), 'warning');
    }
  };

  const groups = ['WARMUP', 'MAIN', 'COOLDOWN', 'RECOVERY'].map((s) => ({ section: s, entries: data?.entries.filter((e) => e.section === s) ?? [] })).filter((g) => g.entries.length > 0);

  return (
    <Screen>
      <ScreenHeader title={data?.title ?? 'Günlük program'} subtitle={data ? `${data.dayNumber}. gün · ${formatLong(data.date)}` : undefined} onBack={back} />
      {error ? <Notice kind="warning" text={error} /> : null}
      {safety ? <Notice kind="warning" title="Güvenlik" text={safety} /> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Tag label={SOURCE_TAG} kind="accent" />
            <Tag label={`${data.progress.doneMain}/${data.progress.plannedMain} hareket`} kind={data.progress.plannedMain > 0 && data.progress.doneMain === data.progress.plannedMain ? 'success' : 'neutral'} />
            {data.kind === 'TRAINING' ? <Tag label={`~${data.estimatedMinutes} dk · ~${data.estimatedKcal} kcal (tahmini)`} /> : null}
          </View>
          {groups.map((g) => (
            <View key={g.section}>
              <SectionHeader title={SECTION_LABELS[g.section] ?? g.section} />
              {g.entries.map((e) => (
                <Card key={e.index}>
                  <Pressable onPress={() => setOpen(open === e.index ? null : e.index)} accessibilityRole="button">
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text variant="heading" style={{ flex: 1 }}>
                        {e.index + 1}. {e.title}
                      </Text>
                      {e.log ? <Tag label={e.log.status === 'DONE' ? 'Tamam' : 'Atlandı'} kind={e.log.status === 'DONE' ? 'success' : 'neutral'} /> : e.optional ? <Tag label="İsteğe bağlı" /> : null}
                    </View>
                    <Text variant="body" tone="secondary" style={{ marginTop: 2 }}>
                      {e.workText}
                    </Text>
                    {e.original ? (
                      <Text variant="caption" tone="muted">
                        {e.original.title} yerine
                      </Text>
                    ) : null}
                  </Pressable>

                  {open === e.index ? (
                    <View style={{ marginTop: 8 }}>
                      <Text variant="caption" tone="muted" style={{ marginBottom: 6 }}>
                        Neden bu hareket: {e.rationale}
                      </Text>
                      {e.steps.map((s, i) => (
                        <Text key={s} variant="body" style={{ marginBottom: 4 }}>
                          {i + 1}. {s}
                        </Text>
                      ))}
                      {e.mistakes.length ? (
                        <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                          Sık hata: {e.mistakes.join(', ')}
                        </Text>
                      ) : null}
                      {e.warnings.map((w) => (
                        <Text key={w} variant="caption" tone="warning" style={{ marginTop: 4 }}>
                          ⚠ {w}
                        </Text>
                      ))}
                      {e.videoUrl ? <Button label="Videoyu aç" size="sm" variant="ghost" onPress={() => void Linking.openURL(e.videoUrl!)} /> : null}
                    </View>
                  ) : null}

                  {/* Zamanlayıcılar: süreli hareketlerde çalışma süresi, setli hareketlerde set arası dinlenme */}
                  {e.section !== 'RECOVERY' && (e.seconds !== null || e.restSec > 0) ? (
                    <View style={{ gap: 6, marginTop: 10 }}>
                      {e.seconds !== null ? <RestTimer seconds={e.seconds} label="Süre" /> : null}
                      {e.restSec > 0 && e.sets > 1 ? <RestTimer seconds={e.restSec} label="Dinlenme" /> : null}
                    </View>
                  ) : null}

                  {e.log?.status !== 'DONE' ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {canLog ? <Button label="Tamamladım" size="sm" onPress={() => openDone(e)} /> : null}
                      {canLog ? <Button label="Atla" size="sm" variant="secondary" onPress={() => send(e, 'SKIPPED')} /> : null}
                      {canSwap && e.alternatives.length > 0 ? <Button label="Değiştir" size="sm" variant="ghost" onPress={() => setAlt(e)} /> : null}
                      {!canLog ? (
                        <Text variant="caption" tone="muted">
                          Bu günün hareketleri gününde işaretlenir.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {e.log?.status === 'DONE' ? (
                    <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
                      Zorlanma: {e.log.rpe ?? '—'}/10{e.log.pain ? ' · ağrı bildirildi' : ''}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          ))}
          <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
            {data.safety}
          </Text>
        </>
      ) : null}

      {/* Tamamlandı: zorlanma ve ağrı */}
      <BottomSheet visible={done !== null} onClose={() => setDone(null)} title={done?.title ?? ''}>
        <Text variant="bodyStrong" style={{ marginBottom: 6 }}>
          Ne kadar zorlandın? ({rpeHint(Number(rpe))})
        </Text>
        <ChipRow options={RPE} selected={[rpe]} onToggle={setRpe} />
        <View style={{ marginTop: 12 }}>
          <ListRow icon="alert-circle-outline" title="Ağrı hissettim" subtitle={pain ? 'Bölgeyi seç' : undefined} onPress={() => setPain(!pain)} trailing={<Tag label={pain ? 'Evet' : 'Hayır'} kind={pain ? 'warning' : 'neutral'} />} last />
        </View>
        {pain ? (
          <>
            <ChipRow wrap options={(Object.keys(AREA_LABELS) as PlanBodyArea[]).map((a) => ({ key: a, label: AREA_LABELS[a] }))} selected={area ? [area] : []} onToggle={(a) => setArea(a === area ? null : a)} />
            <ListRow icon="warning-outline" title="Ağrı keskindi" onPress={() => setSharp(!sharp)} trailing={<Tag label={sharp ? 'Evet' : 'Hayır'} kind={sharp ? 'danger' : 'neutral'} />} last />
            <Notice kind="warning" text="Ağrı hissettiğinde hareketi bırak. Ağrı programdaki sonraki haftaları da etkiler: o bölgeyi yükleyen hareketler çıkarılır." />
          </>
        ) : null}
        <Button label="Kaydet" block onPress={() => done && send(done, 'DONE')} style={{ marginTop: 12 }} />
      </BottomSheet>

      {/* Anlık uyarlama: alternatif hareketler */}
      <BottomSheet visible={alt !== null} onClose={() => setAlt(null)} title="Alternatif hareket">
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          Aynı amaca hizmet eden, kısıtlarına uygun seçenekler:
        </Text>
        {alt?.alternatives.map((a, i) => (
          <ListRow key={a.id} icon="swap-horizontal-outline" title={a.title} onPress={() => swap(alt, a.id)} last={i === alt.alternatives.length - 1} />
        ))}
      </BottomSheet>
    </Screen>
  );
}
