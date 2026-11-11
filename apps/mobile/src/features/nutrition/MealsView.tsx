// Günlük öğün kaydı: kalori halkası, öğünler, diyetisyen planı ve beslenme rehberleri.
import {
  ALLERGEN_LABELS_TR,
  findFood,
  MEAL_SLOT_LABELS_TR,
  MEAL_SLOTS,
  type MealSlot,
} from '@fitapp/shared';
import { Button, Card, IconButton, ListRow, Notice, ProgressRing, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WeekStrip } from '@/components/WeekStrip';
import { addMeals, removeMeal } from '@/demo/actions';
import { ARTICLES } from '@/demo/content';
import { formatLong } from '@/demo/dates';
import { useAccount, useEnsureConsent, useShared, useToday, useUserData } from '@/demo/hooks';
import { mealsBySlot, totalsOf } from '@/demo/selectors';
import { AddFoodSheet } from './AddFoodSheet';
import { useTarget } from './useTarget';

export function MealsView({ hideCalories = false }: { hideCalories?: boolean }) {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  const shared = useShared();
  const today = useToday();
  const { target, result } = useTarget();
  const ensureConsent = useEnsureConsent();
  const [date, setDate] = useState(today);
  const [sheetSlot, setSheetSlot] = useState<MealSlot | null>(null);

  const entries = data.meals[date];
  const totals = useMemo(() => totalsOf(entries ?? []), [entries]);
  const bySlot = useMemo(() => mealsBySlot(entries ?? []), [entries]);
  const marked = useMemo(() => Object.keys(data.meals).filter((d) => (data.meals[d]?.length ?? 0) > 0), [data.meals]);

  // Danışanı olduğu diyetisyenin hazırladığı plan
  const plan = useMemo(
    () => shared.plans.find((p) => shared.clients[p.clientId]?.accountId === account?.id),
    [shared.plans, shared.clients, account?.id],
  );

  const guides = ARTICLES.filter((a) => (hideCalories ? a.forTeens : true));

  return (
    <View>
      {!data.consents.health_data ? (
        <Notice
          kind="warning"
          title="Sağlık verisi izni kapalı"
          text={
            hideCalories
              ? 'Öğün kaydı için sağlık verisi rızası gerekir. Genç modunda bu rıza velin tarafından verilir.'
              : 'Öğün kaydı için sağlık verisi rızası gerekir. Profil bölümünden izin verebilirsin.'
          }
        />
      ) : null}
      <WeekStrip selected={date} onSelect={setDate} marked={marked} />

      {!hideCalories ? (
        <Card variant="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ProgressRing value={totals.kcal} goal={target} size={118} stroke={12} light>
              <Text variant="title" tone="onAccent">
                {totals.kcal}
              </Text>
              <Text variant="micro" tone="onAccent">
                / {target} kcal
              </Text>
            </ProgressRing>
            <View style={{ flex: 1, gap: 8 }}>
              <Text variant="caption" tone="onAccent" style={{ opacity: 0.9 }}>
                {formatLong(date)}
              </Text>
              {[
                ['Protein', totals.proteinG, result?.macros.proteinG ?? 0],
                ['Karbonhidrat', totals.carbsG, result?.macros.carbsG ?? 0],
                ['Yağ', totals.fatG, result?.macros.fatG ?? 0],
              ].map(([label, value, goal]) => (
                <View key={String(label)}>
                  <Text variant="micro" tone="onAccent">
                    {label} · {value} / {goal} g
                  </Text>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                    <View
                      style={{
                        width: `${Math.min(100, Number(goal) > 0 ? (Number(value) / Number(goal)) * 100 : 0)}%`,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Card>
      ) : (
        <Notice kind="info" title="Genç modu" text="Kalori sayımı ve kilo hedefi kapalıdır. Öğünlerini sadece düzenli beslenme alışkanlığı için kaydedebilirsin." />
      )}

      {!hideCalories && plan ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text variant="heading">Diyetisyeninin planı</Text>
            <Tag label={`${plan.targetKcal} kcal`} kind="accent" />
          </View>
          {plan.menu.map((slot) => (
            <View key={slot.slot} style={{ marginBottom: 6 }}>
              <Text variant="caption" tone="secondary" style={{ fontWeight: '700' }}>
                {MEAL_SLOT_LABELS_TR[slot.slot]}
              </Text>
              <Text variant="body">
                {slot.items
                  .map((i) => `${findFood(i.foodId)?.name ?? ''}${i.servings !== 1 ? ` (${i.servings}×)` : ''}`)
                  .join(', ')}
              </Text>
            </View>
          ))}
          <Button
            label="Bugüne ekle"
            variant="secondary"
            size="sm"
            icon="add"
            onPress={() => {
              if (!account || !ensureConsent()) return;
              addMeals(
                account.id,
                today,
                plan.menu.flatMap((s) => s.items.map((i) => ({ slot: s.slot, foodId: i.foodId, servings: i.servings }))),
              );
              showToast('Plan bugünkü kayıtlarına eklendi');
            }}
            style={{ marginTop: 6 }}
          />
        </Card>
      ) : null}

      {MEAL_SLOTS.map((slot) => {
        const items = bySlot[slot];
        const slotKcal = totalsOf(items).kcal;
        return (
          <Card key={slot}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="heading">{MEAL_SLOT_LABELS_TR[slot]}</Text>
                {!hideCalories ? (
                  <Text variant="caption" tone="secondary">
                    {slotKcal} kcal
                  </Text>
                ) : null}
              </View>
              <IconButton icon="add" label={`${MEAL_SLOT_LABELS_TR[slot]} için yemek ekle`} size={38} filled onPress={() => setSheetSlot(slot)} />
            </View>
            {items.map((entry, i) => {
              const food = findFood(entry.foodId);
              if (!food) return null;
              const conflict = food.allergens.filter((a) => data.allergens.includes(a));
              return (
                <ListRow
                  key={entry.id}
                  icon="restaurant-outline"
                  title={food.name}
                  subtitle={`${entry.servings}× ${food.portion}${conflict.length ? ` · ${conflict.map((a) => ALLERGEN_LABELS_TR[a]).join(', ')} içerir` : ''}`}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {!hideCalories ? (
                        <Text variant="bodyStrong">{Math.round(food.kcal * entry.servings)}</Text>
                      ) : null}
                      {conflict.length ? <Tag label="Alerjen" kind="danger" /> : null}
                      <IconButton
                        icon="trash-outline"
                        label="Kaydı sil"
                        size={34}
                        onPress={() => account && removeMeal(account.id, date, entry.id)}
                      />
                    </View>
                  }
                  last={i === items.length - 1}
                />
              );
            })}
            {items.length === 0 ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
                Henüz eklenmedi.
              </Text>
            ) : null}
          </Card>
        );
      })}

      {!hideCalories ? (
        <Notice kind="info" text="Değerler tahminidir. Kesin değerler ve sana özel plan için bir diyetisyenle çalış." />
      ) : null}
      {!hideCalories && !plan ? <Button label="Diyetisyen bul" variant="ghost" block onPress={() => router.push('/discover')} /> : null}

      <SectionHeader title="Beslenme rehberi" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {guides.map((a, i) => (
          <ListRow
            key={a.id}
            icon="book-outline"
            title={a.title}
            subtitle={`${a.tag} · ${a.minutes} dk okuma`}
            onPress={() => router.push(`/article/${a.id}`)}
            last={i === guides.length - 1}
          />
        ))}
      </Card>

      {sheetSlot ? (
        <AddFoodSheet visible slot={sheetSlot} date={date} hideCalories={hideCalories} onClose={() => setSheetSlot(null)} />
      ) : null}
    </View>
  );
}
