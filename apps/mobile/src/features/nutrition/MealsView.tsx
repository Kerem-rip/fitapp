// Günlük öğün kaydı: kalori halkası, öğünler, diyetisyen planı ve beslenme rehberleri.
// Öğünler sunucuda tutulur; danışan "Öğün kayıtlarım"ı paylaştıysa uzmanı da görür. Değerler tahminidir.
import type { MealEntryItem, MyPlanListItem } from '@fitapp/api-client';
import { ALLERGEN_LABELS_TR, findFood, MEAL_SLOT_LABELS_TR, MEAL_SLOTS, type MealSlot } from '@fitapp/shared';
import { Avatar, Card, IconButton, ListRow, Notice, ProgressRing, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { WeekStrip } from '@/components/WeekStrip';
import { ARTICLES } from '@/demo/content';
import { formatLong } from '@/demo/dates';
import { useToday, useUserData } from '@/demo/hooks';
import { useMyAllergens } from '@/features/health/useMyAllergens';
import { AddFoodSheet, mealTypeOf } from './AddFoodSheet';
import { useFoodLog } from './useFoodLog';
import { useTarget } from './useTarget';

export function MealsView({ hideCalories = false }: { hideCalories?: boolean }) {
  const router = useRouter();
  const data = useUserData();
  const today = useToday();
  const { target, result, missing } = useTarget();
  const [date, setDate] = useState(today);
  const [sheetSlot, setSheetSlot] = useState<MealSlot | null>(null);
  const { day, marked, error, run } = useFoodLog(date);
  const { allergens } = useMyAllergens();
  const [plan, setPlan] = useState<MyPlanListItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .myPlans()
        .then((list) => setPlan(list[0] ?? null))
        .catch(() => setPlan(null));
    }, []),
  );

  const totals = day.totals;
  const slotItems = (slot: MealSlot) => day.meals.filter((m) => m.mealType === mealTypeOf(slot));
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
      {error ? <Notice kind="danger" text={error} /> : null}
      <WeekStrip selected={date} onSelect={(d) => (d <= today ? setDate(d) : undefined)} marked={marked} />

      {!hideCalories ? (
        <Card variant="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ProgressRing value={totals.kcal} goal={missing ? Math.max(totals.kcal, 1) : target} size={118} stroke={12} light>
              <Text variant="title" tone="onAccent">
                {totals.kcal}
              </Text>
              <Text variant="micro" tone="onAccent">
                {missing ? 'kcal (tahmini)' : `/ ${target} kcal`}
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
                    {label} · {Number(value).toLocaleString('tr-TR')}{Number(goal) > 0 ? ` / ${goal}` : ''} g
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

      {!hideCalories && missing ? (
        <Notice kind="info" text="Günlük hedefini görmek için Profil › Profilini doldur bölümünden boy ve kilonu ekle ya da Hesapla sekmesinden kendi hedefini belirle." />
      ) : null}

      {!hideCalories && plan ? (
        <Card onPress={() => router.push(`/my-plan/${plan.planId}`)} variant="soft">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={plan.professional.name} size={42} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Diyetisyeninin planı · sürüm {plan.number}</Text>
              <Text variant="caption" tone="secondary">
                {plan.professional.name} · {plan.mealCount} öğün. Açmak için dokun.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {MEAL_SLOTS.map((slot) => {
        const items = slotItems(slot);
        const slotKcal = Math.round(items.reduce((s, m) => s + m.kcal, 0));
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
            {items.map((entry, i) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                allergens={allergens}
                hideCalories={hideCalories}
                onRemove={() => run(() => api.removeMeal(entry.id), 'Kayıt silindi')}
                last={i === items.length - 1}
              />
            ))}
            {items.length === 0 ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
                Henüz eklenmedi.
              </Text>
            ) : null}
          </Card>
        );
      })}

      {!hideCalories ? <Notice kind="info" text="Değerler tahminidir. Kesin değerler ve sana özel plan için bir diyetisyenle çalış." /> : null}

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

      {sheetSlot ? <AddFoodSheet slot={sheetSlot} date={date} hideCalories={hideCalories} onClose={() => setSheetSlot(null)} run={run} /> : null}
    </View>
  );
}

function EntryRow({
  entry,
  allergens,
  hideCalories,
  onRemove,
  last,
}: {
  entry: MealEntryItem;
  allergens: readonly string[];
  hideCalories: boolean;
  onRemove: () => void;
  last: boolean;
}) {
  // Yemek listesindeki kaydın alerjenleri (liste dışı kayıtta bilinmez)
  const food = entry.foodKey ? findFood(entry.foodKey) : undefined;
  const conflict = food ? food.allergens.filter((a) => allergens.includes(a)) : [];
  return (
    <ListRow
      icon="restaurant-outline"
      title={entry.name}
      subtitle={`${entry.servings.toLocaleString('tr-TR')}× ${entry.portion}${conflict.length ? ` · ${conflict.map((a) => ALLERGEN_LABELS_TR[a]).join(', ')} içerir` : ''}`}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!hideCalories ? <Text variant="bodyStrong">{Math.round(entry.kcal)}</Text> : null}
          {conflict.length ? <Tag label="Alerjen" kind="danger" /> : null}
          <IconButton icon="trash-outline" label="Kaydı sil" size={34} onPress={onRemove} />
        </View>
      }
      last={last}
    />
  );
}
