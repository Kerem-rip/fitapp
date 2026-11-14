// Antrenman kartı: sıralı hareketler (sıra, set/tekrar, dinlenme), kısıt seçimi, "Hemen Başla" ve "Takvime ekle". Sade ve tek akışlı.
import type { BodyAreaKey, WorkoutCardDetail } from '@fitapp/api-client';
import { Button, Card, Notice, Screen, ScreenHeader, showToast, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatShort } from '@/demo/dates';
import { LEVEL_TEXT } from '@/features/library/labels';
import { CardSequence } from './CardSequence';
import { parseAvoidParam, RestrictionPicker } from './RestrictionPicker';

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((o) => ({ key: dateKey(o), label: o === 0 ? 'Bugün' : o === 1 ? 'Yarın' : formatShort(dateKey(o)) }));

export function WorkoutCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; avoid?: string }>();
  const [avoid, setAvoid] = useState<BodyAreaKey[]>(parseAvoidParam(params.avoid));
  const [card, setCard] = useState<WorkoutCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(DAY_OPTIONS[0]!.key);
  const [busy, setBusy] = useState(false);
  const [showRestrictions, setShowRestrictions] = useState(avoid.length > 0);
  const [showBasis, setShowBasis] = useState(false);

  useEffect(() => {
    api
      .workoutCard(params.id, avoid)
      .then((c) => {
        setCard(c);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [params.id, avoid]);

  const addToCalendar = async () => {
    setBusy(true);
    try {
      await api.addWorkoutCardTask(params.id, day, avoid);
      showToast(`${DAY_OPTIONS.find((d) => d.key === day)?.label ?? ''} görevlerine eklendi`);
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  return (
    <Screen>
      <ScreenHeader title={card?.title ?? 'Antrenman'} subtitle={card ? `${card.categoryLabel} · ${LEVEL_TEXT[card.level] ?? card.level}` : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {card ? (
        <>
          <Text variant="body" tone="secondary">
            {card.summary}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 4, marginBottom: 12 }}>
            ~{card.estimatedMinutes} dk · {card.moveCount} hareket · {card.region} · {card.equipment.length ? card.equipment.join(', ') : 'Ekipmansız'}
          </Text>

          <Button label="Hemen Başla" icon="play-circle-outline" block onPress={() => router.push({ pathname: '/workout-play/[id]', params: { id: card.id, avoid: avoid.join(',') } })} />

          <View style={{ marginTop: 16 }}>
            <Button label={showRestrictions ? 'Kısıtlarım' : `Ağrı ya da sakatlığım var${avoid.length ? ` (${avoid.length})` : ''}`} variant="ghost" size="sm" onPress={() => setShowRestrictions((v) => !v)} />
            {showRestrictions ? <RestrictionPicker value={avoid} onChange={setAvoid} /> : null}
          </View>
          {card.swapped.map((s) => (
            <Notice key={s.from} kind="info" text={s.toTitle ? `${s.area} kısıtın nedeniyle “${s.fromTitle}” yerine “${s.toTitle}” önerildi.` : `${s.area} kısıtın nedeniyle “${s.fromTitle}” çıkarıldı (uygun alternatif yok).`} />
          ))}

          <Card style={{ marginTop: 8 }}>
            <Text variant="bodyStrong" style={{ marginBottom: 8 }}>
              Sırayla yap
            </Text>
            <CardSequence sections={card.sections} onItem={(id) => router.push(`/library-item/${id}`)} />
          </Card>

          <Card variant="soft">
            <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
              Başlamadan önce
            </Text>
            {card.prep.map((p) => (
              <Text key={p} variant="caption" tone="secondary" style={{ marginBottom: 2 }}>
                • {p}
              </Text>
            ))}
          </Card>

          <Text variant="caption" tone="muted" style={{ marginTop: 8 }} onPress={() => setShowBasis((v) => !v)}>
            {showBasis ? '▾ Bu kartın dayanağı' : '▸ Bu kartın dayanağı'}
          </Text>
          {showBasis ? (
            <Card>
              {card.basis.map((b) => (
                <Text key={b} variant="caption" tone="secondary" style={{ marginBottom: 2 }}>
                  • {b}
                </Text>
              ))}
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {card.disclaimer}
              </Text>
            </Card>
          ) : null}

          <Text variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>
            Takvime ekle
          </Text>
          <ChipRow options={DAY_OPTIONS} selected={[day]} onToggle={setDay} />
          <Button label="Takvime ekle" icon="calendar-outline" variant="secondary" block onPress={addToCalendar} disabled={busy} />
        </>
      ) : null}
    </Screen>
  );
}
