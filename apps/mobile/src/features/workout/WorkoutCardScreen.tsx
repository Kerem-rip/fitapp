// Antrenman kartı: büyük görsel, tek satır bilgi, hedef ve hedef bölge, resimli hareket satırları ve altta sabit "Antrenmana Başla".
// Sade tutuldu: kısıt, hazırlık, dayanak ve takvime ekleme listenin altında.
import type { BodyAreaKey, WorkoutCardDetail } from '@fitapp/api-client';
import { Button, Card, Icon, Notice, Screen, ScreenHeader, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatShort } from '@/demo/dates';
import { LEVEL_TEXT } from '@/features/library/labels';
import { HeroImage } from './CardHero';
import { DEMO_CREDITS } from './demoMedia';
import { MoveThumb } from './MoveThumb';
import { parseAvoidParam, RestrictionPicker } from './RestrictionPicker';

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((o) => ({ key: dateKey(o), label: o === 0 ? 'Bugün' : o === 1 ? 'Yarın' : formatShort(dateKey(o)) }));

// "3 set × 12" / "2 set × 30 sn" / "1 × 60 sn"; tek taraflı hareketlerde "/ taraf"
function shortWork(w: { sets: number; reps?: number; seconds?: number; perSide?: boolean }) {
  const amount = w.seconds !== undefined ? `${w.seconds} sn` : `${w.reps}`;
  const side = w.perSide ? ' / taraf' : '';
  return w.sets > 1 ? `${w.sets} set × ${amount}${side}` : `${amount}${side}`;
}

function Meta({ icon, text }: { icon: 'time-outline' | 'bar-chart-outline' | 'home-outline' | 'barbell-outline'; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={20} color={c.textSecondary} />
      <Text variant="bodyStrong" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="micro" tone="muted" style={{ marginTop: 16, marginBottom: 4, letterSpacing: 1 }}>
      {children.toLocaleUpperCase('tr')}
    </Text>
  );
}

export function WorkoutCardScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
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
      .then((d) => {
        setCard(d);
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
  const credit = card ? DEMO_CREDITS[card.hero] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <ScreenHeader title="" onBack={back} />
        {error ? <Notice kind="danger" text={error} /> : null}
        {card ? (
          <>
            <HeroImage hero={card.hero} height={220} />
            {credit ? (
              <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
                Geçici demo görseli · {credit.author} · {credit.license} · Wikimedia Commons
              </Text>
            ) : null}

            <Text variant="title" style={{ marginTop: 16 }}>
              {card.title}
            </Text>
            <Text variant="body" tone="secondary" style={{ marginTop: 2, marginBottom: 12 }}>
              {card.summary}
            </Text>
            <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
              <Meta icon="time-outline" text={`${card.estimatedMinutes} dakika`} />
              <Meta icon="bar-chart-outline" text={LEVEL_TEXT[card.level] ?? card.level} />
              <Meta icon={card.setting === 'gym' ? 'barbell-outline' : 'home-outline'} text={card.setting === 'gym' ? 'Salonda' : 'Evde'} />
            </View>

            <Label>Hedef</Label>
            <Text variant="heading">{card.goal}</Text>
            <Label>Antrenman serisi</Label>
            <Text variant="heading">{card.moveCount} egzersiz</Text>
            <Label>Hedef bölge</Label>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {card.areas.map((a) => (
                <View key={a} style={{ backgroundColor: c.surfaceAlt, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text variant="bodyStrong">{a}</Text>
                </View>
              ))}
            </View>
            {card.equipment.length ? (
              <>
                <Label>Ekipman</Label>
                <Text variant="body">{card.equipment.join(', ')}</Text>
              </>
            ) : null}

            {card.swapped.map((s) => (
              <View key={s.from} style={{ marginTop: 12 }}>
                <Notice kind="info" text={s.toTitle ? `${s.area} kısıtın nedeniyle “${s.fromTitle}” yerine “${s.toTitle}” önerildi.` : `${s.area} kısıtın nedeniyle “${s.fromTitle}” çıkarıldı (uygun alternatif yok).`} />
              </View>
            ))}

            {card.sections.map((s) => (
              <View key={s.kind}>
                <Label>{`${s.title} · ${s.hint}`}</Label>
                {s.items.map((i) => (
                  <View key={`${i.order}-${i.itemId}`}>
                    <Pressable
                      onPress={() => router.push(`/library-item/${i.itemId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${i.order}. ${i.title}, ${shortWork(i.work)}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surfaceAlt, borderRadius: 18, padding: 10, marginTop: 8 }}
                    >
                      <MoveThumb primary={i.primary} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{i.title}</Text>
                        {i.replacedFrom ? (
                          <Text variant="micro" tone="muted">
                            “{i.replacedFrom.title}” yerine
                          </Text>
                        ) : null}
                      </View>
                      <Text variant="caption" tone="secondary" style={{ paddingRight: 6 }}>
                        {shortWork(i.work)}
                      </Text>
                    </Pressable>
                    {i.restAfterSec > 0 ? (
                      <Text variant="micro" tone="muted" style={{ textAlign: 'center', marginTop: 6 }}>
                        ↓ {i.restAfterSec} sn dinlen
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}

            <View style={{ marginTop: 20 }}>
              <Button label={showRestrictions ? 'Kısıtlarım' : `Ağrı ya da sakatlığım var${avoid.length ? ` (${avoid.length})` : ''}`} variant="ghost" size="sm" onPress={() => setShowRestrictions((v) => !v)} />
              {showRestrictions ? <RestrictionPicker value={avoid} onChange={setAvoid} /> : null}
            </View>

            <Card variant="soft" style={{ marginTop: 8 }}>
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

            <Label>Takvime ekle</Label>
            <ChipRow options={DAY_OPTIONS} selected={[day]} onToggle={setDay} />
            <Button label="Takvime ekle" icon="calendar-outline" variant="secondary" block onPress={addToCalendar} disabled={busy} />
            <View style={{ height: 96 }} />
          </>
        ) : null}
      </Screen>

      {card ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          <Button label="Antrenmana Başla" icon="play-circle-outline" size="lg" block onPress={() => router.push({ pathname: '/workout-play/[id]', params: { id: card.id, avoid: avoid.join(',') } })} />
        </View>
      ) : null}
    </View>
  );
}
