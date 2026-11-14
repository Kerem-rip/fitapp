// Antrenman kartı: bölümler (hazırlık, ısınma, ana, bitiş), kısıt seçimi, "Hemen Başla" ve "Takvime ekle".
import type { BodyAreaKey, WorkoutCardDetail } from '@fitapp/api-client';
import { Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatShort } from '@/demo/dates';
import { LEVEL_TEXT, VERIFICATION_TEXT } from '@/features/library/labels';
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
      <ScreenHeader title={card?.title ?? 'Antrenman'} subtitle={card?.categoryLabel} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {card ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Tag label={LEVEL_TEXT[card.level] ?? card.level} kind="info" />
            <Tag label={`~${card.estimatedMinutes} dk`} />
            <Tag label={`${card.moveCount} hareket`} />
            <Tag label={card.equipment.length ? card.equipment.join(', ') : 'Ekipmansız'} />
            <Tag label={card.region} />
          </View>
          <Text variant="body" tone="secondary" style={{ marginBottom: 8 }}>
            {card.summary}
          </Text>

          <RestrictionPicker value={avoid} onChange={setAvoid} />
          {card.swapped.map((s) => (
            <Notice key={s.from} kind="info" text={s.toTitle ? `${s.area} kısıtın nedeniyle “${s.fromTitle}” yerine “${s.toTitle}” önerildi.` : `${s.area} kısıtın nedeniyle “${s.fromTitle}” çıkarıldı (uygun alternatif yok).`} />
          ))}

          {card.prep.length ? (
            <Card variant="soft">
              <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
                Başlamadan önce
              </Text>
              {card.prep.map((p) => (
                <Text key={p} variant="body" tone="secondary" style={{ marginBottom: 2 }}>
                  • {p}
                </Text>
              ))}
            </Card>
          ) : null}

          {card.sections.map((s) => (
            <View key={s.kind}>
              <SectionHeader title={s.title} />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {s.items.map((i, idx) => (
                  <ListRow
                    key={i.itemId}
                    icon="barbell-outline"
                    title={i.title}
                    subtitle={`${i.workText}${i.replacedFrom ? ` · “${i.replacedFrom.title}” yerine` : ''}${i.verification === 'held' || i.verification === 'none' ? ` · ${VERIFICATION_TEXT[i.verification]!.label}` : ''}`}
                    onPress={() => router.push(`/library-item/${i.itemId}`)}
                    last={idx === s.items.length - 1}
                  />
                ))}
              </Card>
            </View>
          ))}

          <SectionHeader title="Bu kartın dayanağı" />
          <Card>
            {card.basis.map((b) => (
              <Text key={b} variant="caption" tone="secondary" style={{ marginBottom: 2 }}>
                • {b}
              </Text>
            ))}
          </Card>
          <Notice kind="info" text={card.disclaimer} />

          <Button label="Hemen Başla" icon="play-circle-outline" block onPress={() => router.push({ pathname: '/workout-play/[id]', params: { id: card.id, avoid: avoid.join(',') } })} style={{ marginTop: 8 }} />
          <SectionHeader title="Takvime ekle" />
          <ChipRow options={DAY_OPTIONS} selected={[day]} onToggle={setDay} />
          <Button label="Takvime ekle" icon="calendar-outline" variant="secondary" block onPress={addToCalendar} disabled={busy} style={{ marginTop: 4 }} />
        </>
      ) : null}
    </Screen>
  );
}
