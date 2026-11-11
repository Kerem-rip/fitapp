// Planım (danışan): her öğünde diyetisyenin tanımladığı alternatiflerden seçerim.
// Sadece izinli alternatifler seçilebilir; alerji bilgim değiştiyse çakışan seçenekler diyetisyen inceleyene kadar kapalıdır.
import type { MyPlanView } from '@fitapp/api-client';
import { Card, IconButton, Notice, Screen, ScreenHeader, showToast, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { allergenText } from '@/features/plans/helpers';
import { formatDay } from '@/features/sharing/labels';

const MAX_DAYS = 7;
const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (offset: number) =>
  offset === 0 ? 'Bugün' : offset === -1 ? 'Dün' : offset === 1 ? 'Yarın' : new Date(Date.now() + offset * 86_400_000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

export default function MyPlanScreen() {
  const router = useRouter();
  const { c, accent, accentSoft } = useTheme();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [offset, setOffset] = useState(0);
  const [plan, setPlan] = useState<MyPlanView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await api.myPlan(planId, isoDay(offset)));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [planId, offset]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggle = async (meal: MyPlanView['meals'][number], optionId: string) => {
    const selected = meal.chosen.includes(optionId);
    let next: string[];
    if (meal.pick === 1) next = selected ? [] : [optionId];
    else if (selected) next = meal.chosen.filter((id) => id !== optionId);
    else if (meal.chosen.length >= meal.pick) {
      showToast(`Bu öğünde en fazla ${meal.pick} seçenek seçebilirsin`, 'warning');
      return;
    } else next = [...meal.chosen, optionId];
    try {
      await api.choosePlanOptions(planId, { date: isoDay(offset), mealId: meal.id, optionIds: next });
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title={plan?.title ?? 'Planım'} subtitle={plan ? `${plan.professional.name} · sürüm ${plan.version.number}` : undefined} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <IconButton icon="chevron-back" label="Önceki gün" size={40} onPress={() => setOffset((o) => Math.max(-MAX_DAYS, o - 1))} />
        <Text variant="heading">{dayLabel(offset)}</Text>
        <IconButton icon="chevron-forward" label="Sonraki gün" size={40} onPress={() => setOffset((o) => Math.min(MAX_DAYS, o + 1))} />
      </View>

      {plan?.anyBlocked ? (
        <Notice kind="warning" title="Bazı seçenekler kapalı" text="Alerji bilgin güncellendiği için çakışan seçenekler diyetisyenin incelemesini bekliyor. Diyetisyenin yeni bir sürüm yayınlayınca güncellenir." />
      ) : null}
      {plan?.notes ? <Notice kind="info" text={plan.notes} /> : null}
      {plan?.targetKcal ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          Diyetisyeninin belirlediği hedef: {plan.targetKcal} kcal
        </Text>
      ) : null}

      {plan?.meals.map((meal) => (
        <Card key={meal.id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">
              {meal.time ? `${meal.time} · ` : ''}
              {meal.name}
            </Text>
            <Tag label={meal.pick === 1 ? '1 seçim' : `${meal.pick} seçime kadar`} kind="neutral" />
          </View>
          {meal.rule ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {meal.rule}
            </Text>
          ) : null}
          <View style={{ gap: 8, marginTop: 10 }}>
            {meal.options.map((o) => {
              const chosen = meal.chosen.includes(o.id);
              const blocked = o.blockedReason !== null;
              return (
                <Pressable
                  key={o.id}
                  disabled={blocked}
                  onPress={() => toggle(meal, o.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: chosen ? accent : c.border,
                    backgroundColor: chosen ? accentSoft : 'transparent',
                    opacity: blocked ? 0.5 : 1,
                  }}
                >
                  <Text variant="bodyStrong">{o.name}</Text>
                  <Text variant="caption" tone="secondary">
                    {o.portion}
                    {o.kcal !== null ? ` · ${o.kcal} kcal` : ''} · {allergenText(o.allergens)}
                  </Text>
                  {o.note ? (
                    <Text variant="caption" tone="muted">
                      {o.note}
                    </Text>
                  ) : null}
                  {blocked ? (
                    <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>
                      {o.blockedReason}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}

      {plan ? (
        <Text variant="micro" tone="muted">
          Plan diyetisyenin tarafından {plan.version.approvedAt ? formatDay(plan.version.approvedAt) : ''} tarihinde onaylandı. Seçimlerin, öğün kayıtlarını paylaşıyorsan diyetisyenine görünür.
        </Text>
      ) : null}
    </Screen>
  );
}
