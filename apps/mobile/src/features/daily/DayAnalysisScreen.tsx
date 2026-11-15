// Gün sonu analizi (herkese açık): yediklerin, içtiklerin ve yaptığın hareketler hedefle karşılaştırılır. Tahmindir, tıbbi tavsiye değildir.
// Önerilen besin/hareket (premium) burada yoktur; analiz kendi girdiğin kayıtlar üzerindendir.
import type { FoodDay, MyProgramDay } from '@fitapp/api-client';
import { analyzeDay, MIN_DAILY_KCAL, type Insight } from '@fitapp/shared';
import { Card, Icon, Notice, Screen, ScreenHeader, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatLong, formatShort } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';

const DAYS = Array.from({ length: 7 }, (_, i) => dateKey(-i));
// Hareket başına ortalama MET (tahmin)
const AVG_MET = 5;

export function DayAnalysisScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const account = useAccount();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date && DAYS.includes(params.date) ? params.date : dateKey(0));
  const [food, setFood] = useState<FoodDay | null>(null);
  const [day, setDay] = useState<MyProgramDay | null>(null);
  const [data, setData] = useState<{ insights: Insight[]; balanceKcal: number | null; empty: boolean; target: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.myFood(date, date).catch(() => [] as FoodDay[]), api.myProgramDay(date), api.routine(date).catch(() => null), api.calorieProfile().catch(() => ({ profile: null })), api.myMeasurements({ kind: 'WEIGHT' }).catch(() => [])])
      .then(([foods, mine, routine, prof, weights]) => {
        if (cancelled) return;
        const f = foods.find((x) => x.date === date) ?? null;
        setFood(f);
        setDay(mine);
        const profile = prof.profile;
        const weightKg = profile?.weightKg ?? weights.filter((w) => !w.voided).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]?.value ?? 70;
        // Tamamlanan antrenmanlar (kart ve program günleri) ve tahmini enerji harcaması
        const doneCards = mine.cards.filter((x) => x.done);
        const doneProgramDays = mine.programs.filter((p) => p.steps.length > 0 && p.doneCount === p.steps.length);
        const minutes = doneCards.reduce((s, x) => s + x.estimatedMinutes, 0) + doneProgramDays.reduce((s, p) => s + Math.round(p.durationSec / 60), 0);
        const units = [...mine.cards.map((x) => x.done), ...mine.programs.flatMap((p) => p.steps.map((s) => s.done)), ...mine.tasks.map((t) => t.done), ...(routine?.items.map((r) => r.done) ?? [])];
        const sex = profile?.sex ?? account?.sex ?? 'other';
        const result = analyzeDay({
          goal: profile?.goal ?? null,
          targetKcal: profile?.targetKcal ?? null,
          targetProteinG: profile?.proteinG ?? null,
          waterGoalMl: profile?.waterMl ?? 2000,
          floorKcal: MIN_DAILY_KCAL[sex],
          eaten: f?.totals ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
          mealCount: f?.meals.length ?? 0,
          waterMl: f?.waterMl ?? 0,
          workoutsDone: doneCards.length + doneProgramDays.length,
          workoutMinutes: minutes,
          burnedKcal: Math.round((AVG_MET * weightKg * minutes) / 60),
          tasksDone: units.filter(Boolean).length,
          tasksTotal: units.length,
        });
        setData({ ...result, target: profile?.targetKcal ?? null });
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
    };
  }, [date, account?.sex]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/program'));
  const iconOf = (l: Insight['level']) => (l === 'good' ? ('checkmark-circle' as const) : l === 'warn' ? ('alert-circle' as const) : ('information-circle' as const));
  const colorOf = (l: Insight['level']) => (l === 'good' ? c.success : l === 'warn' ? c.warning : c.info);

  return (
    <Screen>
      <ScreenHeader title="Günün analizi" subtitle={formatLong(date)} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      <ChipRow options={DAYS.map((d) => ({ key: d, label: d === dateKey(0) ? 'Bugün' : formatShort(d) }))} selected={[date]} onToggle={setDate} />

      {data ? (
        <>
          {!data.empty ? (
            <Card variant="soft">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text variant="micro" tone="muted">
                    YEDİĞİN
                  </Text>
                  <Text variant="title">{food?.totals.kcal ?? 0} kcal</Text>
                </View>
                <View>
                  <Text variant="micro" tone="muted">
                    HEDEF
                  </Text>
                  <Text variant="title">{data.target ? `${data.target} kcal` : '—'}</Text>
                </View>
                <View>
                  <Text variant="micro" tone="muted">
                    FARK
                  </Text>
                  <Text variant="title" style={{ color: accent }}>
                    {data.balanceKcal === null ? '—' : `${data.balanceKcal > 0 ? '+' : ''}${data.balanceKcal}`}
                  </Text>
                </View>
              </View>
              {!data.target ? (
                <Text variant="caption" tone="secondary" style={{ marginTop: 8 }} onPress={() => router.push('/calorie')}>
                  Hedef için Kalori Hesaplama'yı kullanabilirsin ›
                </Text>
              ) : null}
            </Card>
          ) : null}
          {data.insights.map((i) => (
            <View key={i.text} style={{ flexDirection: 'row', gap: 12, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 }}>
              <Icon name={iconOf(i.level)} size={24} color={colorOf(i.level)} />
              <Text variant="body" style={{ flex: 1 }}>
                {i.text}
              </Text>
            </View>
          ))}
          {day && food && food.meals.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              <Text variant="bodyStrong" style={{ marginTop: 12 }}>
                Yediklerin
              </Text>
              {food.meals.map((m) => (
                <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text variant="body" style={{ flex: 1 }}>
                    {m.name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {Math.round(m.kcal)} kcal
                  </Text>
                </View>
              ))}
            </Card>
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
