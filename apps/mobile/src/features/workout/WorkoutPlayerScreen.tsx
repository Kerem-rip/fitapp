// "Hemen Başla": kartın hareketlerini sırayla oynatır. Her hareket: set(ler) → set arası dinlenme → sonraki hareket.
// Süreli setlerde geri sayım, tekrarlı setlerde "Tamamladım". Alternatif seçilebilir; bitince tamamlama kaydı yazılır.
import type { BodyAreaKey, LibraryItemDetail, WorkoutCardDetail, WorkoutCardItem } from '@fitapp/api-client';
import { Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ALT_TYPE_TEXT, durationText } from '@/features/library/labels';
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
  const params = useLocalSearchParams<{ id: string; avoid?: string }>();
  const avoid: BodyAreaKey[] = parseAvoidParam(params.avoid);
  const [card, setCard] = useState<WorkoutCardDetail | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState<Phase>('READY');
  const [detail, setDetail] = useState<LibraryItemDetail | null>(null);
  const [saved, setSaved] = useState(false);

  const current = moves[idx];
  const next = moves[idx + 1];

  // Çalışma ya da dinlenme süresi biterse sıradaki aşamaya geç
  const advance = () => {
    if (!current) return;
    if (phase === 'WORK') {
      const lastSet = set >= current.work.sets;
      if (lastSet) goNextMove();
      else rest(current.work.restSec, () => {
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
      }
    };
    if (idx + 1 < moves.length) rest(markDone ? current.restAfterSec : 0, move);
    else move();
  }

  useEffect(() => {
    api
      .workoutCard(params.id, avoid)
      .then((c) => {
        setCard(c);
        setMoves(c.sections.flatMap((s) => s.items.map((i) => ({ ...i, sectionTitle: s.title }))));
      })
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // Geçerli hareketin yapılışı (adımlar, alternatifler, görsel durumu)
  useEffect(() => {
    setDetail(null);
    if (!current) return;
    api.libraryItem(current.itemId).then(setDetail).catch(() => undefined);
  }, [current?.itemId]);

  useEffect(() => {
    if (phase !== 'DONE' || saved || !card) return;
    setSaved(true);
    const done = moves.filter((m) => m.done).length;
    api.completeWorkoutCard(card.id, done, moves.length, avoid).catch((e) => showToast(errorText(e), 'warning'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startWork = () => {
    if (!current) return;
    if (current.work.seconds) {
      setPhase('WORK');
      timer.start(current.work.seconds * (current.work.perSide ? 2 : 1));
    } else {
      setPhase('WORK');
    }
  };
  const swapTo = async (altId: string, title: string) => {
    try {
      const alt = await api.libraryItem(altId);
      if (!alt.work) return;
      setMoves((list) =>
        list.map((m, i) =>
          i === idx ? { ...m, itemId: alt.id, title: alt.title, workText: alt.workText ?? '', work: alt.work!, durationSec: alt.durationSec ?? 0, verification: alt.evidence.verification, replacedFrom: { id: m.itemId, title: m.title } } : m,
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

  return (
    <Screen>
      <ScreenHeader title={card?.title ?? 'Antrenman'} subtitle={phase === 'DONE' ? 'Tamamlandı' : current ? `Hareket ${idx + 1}/${moves.length} · ${current.sectionTitle}` : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {phase === 'DONE' && card ? (
        <>
          <Notice
            kind={doneCount > 0 ? 'success' : 'info'}
            title="Antrenman bitti"
            text={doneCount > 0 ? `${doneCount}/${moves.length} hareket yapıldı. Kaydın bugünün görevlerine işlendi.` : 'Hiç hareket tamamlanmadı; görev tamamlandı sayılmadı.'}
          />
          <Button label="Görevlerime dön" block onPress={() => router.replace('/program')} />
        </>
      ) : current ? (
        <>
          <Card variant="soft">
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <Tag label={`Set ${set}/${current.work.sets}`} kind="info" />
              {current.replacedFrom ? <Tag label={`“${current.replacedFrom.title}” yerine`} /> : null}
            </View>
            <Text variant="heading">{current.title}</Text>
            <Text variant="body" tone="secondary">
              {current.work.seconds ? `${current.work.seconds} sn${current.work.perSide ? ' (her taraf)' : ''}` : `${current.work.reps} tekrar${current.work.perSide ? ' (her taraf)' : ''}`}
            </Text>
          </Card>

          {phase === 'REST' ? (
            <Card>
              <Text variant="caption" tone="secondary">
                Dinlen
              </Text>
              <Text variant="display" accessibilityLabel="Kalan dinlenme süresi">
                {clock(timer.left)}
              </Text>
              {next && set >= current.work.sets ? (
                <Text variant="body" tone="secondary">
                  Sıradaki: {next.title}
                </Text>
              ) : null}
              <Button label="Dinlenmeyi geç" variant="secondary" onPress={() => { timer.stop(); restDone.current(); }} style={{ marginTop: 8 }} />
            </Card>
          ) : phase === 'WORK' && current.work.seconds ? (
            <Card>
              <Text variant="display" accessibilityLabel="Kalan süre">
                {clock(timer.left)}
              </Text>
              <Button label="Süreyi bitir" variant="secondary" onPress={() => { timer.stop(); advance(); }} style={{ marginTop: 8 }} />
            </Card>
          ) : phase === 'WORK' ? (
            <Button label="Seti tamamladım" icon="checkmark-circle-outline" block onPress={advance} />
          ) : (
            <Button label={current.work.seconds ? 'Süreyi başlat' : 'Başla'} icon="play-outline" block onPress={startWork} />
          )}

          {detail ? (
            <>
              <SectionHeader title="Nasıl yapılır" />
              <Card>
                {detail.steps.map((s, i) => (
                  <Text key={s} variant="body" style={{ marginBottom: 4 }}>
                    {i + 1}. {s}
                  </Text>
                ))}
              </Card>
              {detail.media.status === 'MISSING' ? <Notice kind="info" text="Bu hareketin videosu henüz yok; adımları takip et." /> : null}
              {detail.warnings.map((w) => (
                <Notice key={w} kind="warning" text={w} />
              ))}
              {detail.evidence.alternatives.length ? (
                <>
                  <SectionHeader title="Alternatif" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {detail.evidence.alternatives.map((a) => (
                      <Button key={a.id} size="sm" variant="secondary" label={`${a.title} · ${ALT_TYPE_TEXT[a.type] ?? a.type}`} onPress={() => void swapTo(a.id, a.title)} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Button label="Bu hareketi atla" variant="ghost" onPress={skip} />
            <Button label="Antrenmanı bitir" variant="ghost" onPress={finishEarly} />
          </View>
          {next ? (
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
              Sonraki hareket: {next.title} · {durationText(next.durationSec)}
            </Text>
          ) : null}
        </>
      ) : !error ? (
        <Text variant="body" tone="secondary">
          Yükleniyor…
        </Text>
      ) : null}
    </Screen>
  );
}
