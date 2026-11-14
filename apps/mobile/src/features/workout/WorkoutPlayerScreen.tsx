// "Antrenmana Başla": kartın hareketlerini sırayla oynatır. Üstte hareketin büyük, tekrar eden medyası; altında ad, set ve hedef; en altta sabit ana düğme.
// Her hareket: set(ler) → set arası dinlenme → sonraki hareket. Süreli setlerde geri sayım, tekrarlı setlerde "Seti tamamladım".
// Alternatif seçilebilir, hareket atlanabilir. Bitince tamamlama kaydı yazılır; bir program gününden başlatıldıysa o günün adımları işaretlenir.
import type { BodyAreaKey, LibraryItemDetail, WorkoutCardDetail, WorkoutCardItem } from '@fitapp/api-client';
import { Button, Icon, IconButton, Notice, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ALT_TYPE_TEXT, durationText } from '@/features/library/labels';
import { MoveMedia } from './CardHero';
import { heroFor } from './demoMedia';
import { parseAvoidParam } from './RestrictionPicker';

type Move = WorkoutCardItem & { sectionTitle: string; skipped?: boolean; done?: boolean };
type Phase = 'READY' | 'WORK' | 'REST' | 'DONE';

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Geri sayım: bitince onEnd çağrılır
function useCountdown(onEnd: () => void) {
  const [left, setLeft] = useState(0);
  const end = useRef(0);
  const active = useRef(false);
  const cb = useRef(onEnd);
  cb.current = onEnd;
  useEffect(() => {
    const t = setInterval(() => {
      if (!active.current) return;
      const remaining = Math.max(0, Math.ceil((end.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        active.current = false;
        cb.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, []);
  return {
    left,
    start: (sec: number) => {
      end.current = Date.now() + sec * 1000;
      active.current = true;
      setLeft(sec);
    },
    stop: () => {
      active.current = false;
    },
  };
}

export function WorkoutPlayerScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; avoid?: string; enrollmentId?: string; dayIndex?: string }>();
  const avoid: BodyAreaKey[] = parseAvoidParam(params.avoid);
  const [card, setCard] = useState<WorkoutCardDetail | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState<Phase>('READY');
  const [detail, setDetail] = useState<LibraryItemDetail | null>(null);
  const [saved, setSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const current = moves[idx];
  const next = moves[idx + 1];

  // Çalışma ya da dinlenme süresi biterse sıradaki aşamaya geç
  const advance = () => {
    if (!current) return;
    if (phase === 'WORK') {
      const lastSet = set >= current.work.sets;
      if (lastSet) goNextMove();
      else
        rest(current.work.restSec, () => {
          setSet((s) => s + 1);
          setPhase('READY');
        });
    }
  };
  const timer = useCountdown(() => {
    if (phase === 'WORK') advance();
    else if (phase === 'REST') restDone.current();
  });
  const restDone = useRef<() => void>(() => undefined);

  function rest(sec: number, then: () => void) {
    if (sec <= 0) {
      then();
      return;
    }
    restDone.current = then;
    setPhase('REST');
    timer.start(sec);
  }
  // Hareket bitti (markDone) ya da atlandı; sonraki harekete geçer
  function goNextMove(markDone = true) {
    timer.stop();
    if (!current) return;
    if (markDone) setMoves((list) => list.map((m, i) => (i === idx ? { ...m, done: true } : m)));
    const move = () => {
      if (idx + 1 >= moves.length) {
        setPhase('DONE');
      } else {
        setIdx(idx + 1);
        setSet(1);
        setPhase('READY');
        setShowInfo(false);
      }
    };
    if (idx + 1 < moves.length) rest(markDone ? current.restAfterSec : 0, move);
    else move();
  }

  useEffect(() => {
    api
      .workoutCard(params.id, avoid)
      .then((cd) => {
        setCard(cd);
        setMoves(cd.sections.flatMap((s) => s.items.map((i) => ({ ...i, sectionTitle: s.title }))));
      })
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Geçerli hareketin yapılışı (medya, adımlar, alternatifler)
  useEffect(() => {
    setDetail(null);
    if (!current) return;
    api.libraryItem(current.itemId).then(setDetail).catch(() => undefined);
  }, [current?.itemId]);

  useEffect(() => {
    if (phase !== 'DONE' || saved || !card) return;
    setSaved(true);
    const done = moves.filter((m) => m.done).length;
    if (params.enrollmentId && params.dayIndex !== undefined) {
      // Program gününden başlatıldı: o günün adımları işaretlenir (ayrı kart kaydı açılmaz)
      moves.forEach((m, i) => {
        if (m.done) api.setLibraryStep(params.enrollmentId!, Number(params.dayIndex), i, true).catch(() => undefined);
      });
    } else {
      api.completeWorkoutCard(card.id, done, moves.length, avoid).catch((e) => showToast(errorText(e), 'warning'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startWork = () => {
    if (!current) return;
    setPhase('WORK');
    if (current.work.seconds) timer.start(current.work.seconds * (current.work.perSide ? 2 : 1));
  };
  const swapTo = async (altId: string, title: string) => {
    try {
      const alt = await api.libraryItem(altId);
      if (!alt.work) return;
      setMoves((list) =>
        list.map((m, i) =>
          i === idx ? { ...m, itemId: alt.id, title: alt.title, workText: alt.workText ?? '', work: alt.work!, durationSec: alt.durationSec ?? 0, verification: alt.evidence.verification, primary: alt.primary, replacedFrom: { id: m.itemId, title: m.title } } : m,
        ),
      );
      setSet(1);
      setPhase('READY');
      timer.stop();
      showToast(`“${title}” ile değiştirildi`, 'info');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const skip = () => {
    setMoves((list) => list.map((m, i) => (i === idx ? { ...m, skipped: true } : m)));
    goNextMove(false);
  };
  const finishEarly = () => {
    timer.stop();
    setPhase('DONE');
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  const doneCount = moves.filter((m) => m.done).length;
  const target = current ? (current.work.seconds ? `${current.work.seconds} sn${current.work.perSide ? ' (her taraf)' : ''}` : `${current.work.reps} tekrar${current.work.perSide ? ' (her taraf)' : ''}`) : '';
  const heroKey = detail ? heroFor({ category: detail.category, primary: detail.primary }) : 'fullbody';

  // Alttaki sabit ana düğme: aşamaya göre değişir
  const main =
    phase === 'REST'
      ? { label: 'Dinlenmeyi geç', icon: 'play-skip-forward-outline' as const, onPress: () => { timer.stop(); restDone.current(); } }
      : phase === 'WORK'
        ? current?.work.seconds
          ? { label: 'Süreyi bitir', icon: 'stop-circle-outline' as const, onPress: () => { timer.stop(); advance(); } }
          : { label: 'Seti tamamladım', icon: 'checkmark-circle-outline' as const, onPress: advance }
        : { label: current?.work.seconds ? 'Süreyi başlat' : 'Başla', icon: 'play-circle-outline' as const, onPress: startWork };

  if (phase === 'DONE' && card) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
        <Notice kind={doneCount > 0 ? 'success' : 'info'} title="Antrenman bitti" text={doneCount > 0 ? `${doneCount}/${moves.length} hareket yapıldı. Kaydın Görevlerim'e işlendi.` : 'Hiç hareket tamamlanmadı; görev tamamlandı sayılmadı.'} />
        <View style={{ marginTop: 16 }}>
          <Button label="Görevlerime dön" size="lg" block onPress={() => router.replace('/program')} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* Büyük, tekrar eden hareket medyası: ekranın üst yarısını kaplar */}
        <View>
          <MoveMedia media={detail?.media} hero={heroKey} height={340} radius={0} />
          <View style={{ position: 'absolute', left: 12, right: 12, top: insets.top + 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="chevron-back" label="Geri" onPress={back} />
            <IconButton icon="close" label="Antrenmanı bitir" onPress={finishEarly} />
          </View>
          {detail && detail.media.status !== 'DEMO' ? (
            <Text variant="micro" style={{ position: 'absolute', left: 16, bottom: 10, color: 'rgba(255,255,255,0.85)' }}>
              Bu hareketin videosu henüz yok
            </Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {error ? <Notice kind="danger" text={error} /> : null}
          {current ? (
            <>
              <Text variant="caption" tone="muted">
                {card?.title} · Hareket {idx + 1}/{moves.length} · {current.sectionTitle}
              </Text>
              <Text variant="display" style={{ marginTop: 4 }}>
                {current.title}
              </Text>
              {current.replacedFrom ? (
                <Text variant="caption" tone="muted">
                  “{current.replacedFrom.title}” yerine
                </Text>
              ) : null}

              {phase === 'REST' ? (
                <View style={{ marginTop: 14 }}>
                  <Text variant="caption" tone="secondary">
                    Dinlen
                  </Text>
                  <Text variant="display" accessibilityLabel="Kalan dinlenme süresi" style={{ fontSize: 56, lineHeight: 62 }}>
                    {clock(timer.left)}
                  </Text>
                  {next && set >= current.work.sets ? (
                    <Text variant="bodyStrong" tone="secondary">
                      Sıradaki: {next.title} · {durationText(next.durationSec)}
                    </Text>
                  ) : (
                    <Text variant="bodyStrong" tone="secondary">
                      Sıradaki set: {set + 1}/{current.work.sets}
                    </Text>
                  )}
                </View>
              ) : phase === 'WORK' && current.work.seconds ? (
                <View style={{ marginTop: 14 }}>
                  <Text variant="caption" tone="secondary">
                    Set {set}/{current.work.sets}
                  </Text>
                  <Text variant="display" accessibilityLabel="Kalan süre" style={{ fontSize: 56, lineHeight: 62 }}>
                    {clock(timer.left)}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 14, flexDirection: 'row', gap: 24 }}>
                  <View>
                    <Text variant="micro" tone="muted">
                      SET
                    </Text>
                    <Text variant="title">
                      {set}/{current.work.sets}
                    </Text>
                  </View>
                  <View>
                    <Text variant="micro" tone="muted">
                      HEDEF
                    </Text>
                    <Text variant="title">{target}</Text>
                  </View>
                  {current.work.restSec ? (
                    <View>
                      <Text variant="micro" tone="muted">
                        DİNLENME
                      </Text>
                      <Text variant="title">{current.work.restSec} sn</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Adımlar, uyarılar ve alternatifler: istenince açılır, ekranı doldurmaz */}
              <View style={{ marginTop: 18, alignSelf: 'flex-start' }}>
                <Button label={showInfo ? 'Bilgiyi gizle' : 'Nasıl yapılır'} size="sm" variant="secondary" icon={showInfo ? 'chevron-up' : 'chevron-down'} onPress={() => setShowInfo((v) => !v)} />
              </View>
              {showInfo && detail ? (
                <View style={{ marginTop: 12 }}>
                  {detail.steps.map((s, i) => (
                    <View key={s} style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text variant="micro">{i + 1}</Text>
                      </View>
                      <Text variant="body" style={{ flex: 1 }}>
                        {s}
                      </Text>
                    </View>
                  ))}
                  {detail.warnings.map((w) => (
                    <Notice key={w} kind="warning" text={w} />
                  ))}
                  {detail.evidence.alternatives.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {detail.evidence.alternatives.map((a) => (
                        <Button key={a.id} size="sm" variant="secondary" label={`${a.title} · ${ALT_TYPE_TEXT[a.type] ?? a.type}`} onPress={() => void swapTo(a.id, a.title)} />
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Button label="Bu hareketi atla" variant="ghost" size="sm" onPress={skip} />
              </View>
              {next && phase !== 'REST' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Icon name="arrow-forward" size={16} color={c.textMuted} />
                  <Text variant="caption" tone="muted">
                    Sonraki: {next.title}
                  </Text>
                </View>
              ) : null}
            </>
          ) : !error ? (
            <Text variant="body" tone="secondary">
              Yükleniyor…
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {current ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label={main.label} icon={main.icon} size="lg" block onPress={main.onPress} />
        </View>
      ) : null}
    </View>
  );
}
