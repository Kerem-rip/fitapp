// Örnek menü: boy, kilo, yaş ve alerjilere göre örnek gün menüsü.
// Alerjen içeren yemekler listeye hiç girmez; alerjen bilgisi eksik yemekler önerilmez.
import {
  ALLERGEN_LABELS_TR,
  ALLERGENS,
  MEAL_SLOT_LABELS_TR,
  menuItemKcal,
  SEED_FOODS,
  suggestMenu,
  type Allergen,
  type DietPreference,
} from '@fitapp/shared';
import { Button, Card, ListRow, Notice, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { addMeals, updateHealth } from '@/demo/actions';
import { useAccount, useEnsureConsent, useToday, useUserData } from '@/demo/hooks';
import { DIET_LABELS } from '@/demo/labels';
import { useTarget } from './useTarget';

export function MenuView() {
  const account = useAccount();
  const data = useUserData();
  const today = useToday();
  const { target } = useTarget();
  const ensureConsent = useEnsureConsent();
  const [variant, setVariant] = useState(0);

  const menu = useMemo(
    () => suggestMenu(SEED_FOODS, { targetKcal: target, allergens: data.allergens, diet: data.diet, variant }),
    [target, data.allergens, data.diet, variant],
  );

  const toggleAllergen = (a: Allergen) => {
    if (!account) return;
    const next = data.allergens.includes(a) ? data.allergens.filter((x) => x !== a) : [...data.allergens, a];
    updateHealth(account.id, { allergens: next });
    setVariant(0);
  };

  const addToToday = () => {
    if (!account || !ensureConsent()) return;
    addMeals(
      account.id,
      today,
      menu.slots.flatMap((s) => s.items.map((i) => ({ slot: s.slot, foodId: i.food.id, servings: i.servings }))),
    );
    showToast('Menü bugünkü kayıtlarına eklendi');
  };

  return (
    <View>
      <Text variant="subheading" style={{ marginBottom: 4 }}>
        Alerjilerin
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
        Seçtiklerin menüye hiç girmez. Bu bilgiler profilinde de kayıtlıdır.
      </Text>
      <ChipRow wrap options={ALLERGENS.map((key) => ({ key, label: ALLERGEN_LABELS_TR[key] }))} selected={data.allergens} onToggle={toggleAllergen} />

      <Text variant="subheading" style={{ marginBottom: 8 }}>
        Beslenme tercihin
      </Text>
      <ChipRow
        options={(Object.keys(DIET_LABELS) as DietPreference[]).map((key) => ({ key, label: DIET_LABELS[key] }))}
        selected={[data.diet]}
        onToggle={(diet) => {
          if (account) updateHealth(account.id, { diet });
          setVariant(0);
        }}
      />

      <Card variant="soft">
        <Text variant="bodyStrong">Örnek gün · yaklaşık {menu.totalKcal} kcal</Text>
        <Text variant="caption" tone="secondary">
          Hedefin: {target} kcal. Değerler tahminidir.
        </Text>
      </Card>

      {menu.slots.map((slot) => (
        <Card key={slot.slot}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text variant="heading">{MEAL_SLOT_LABELS_TR[slot.slot]}</Text>
            <Tag label={`${slot.kcal} kcal`} kind="accent" />
          </View>
          {slot.items.map((item, i) => (
            <ListRow
              key={item.food.id}
              icon="restaurant-outline"
              title={item.food.name}
              subtitle={`${item.servings}× ${item.food.portion}`}
              trailing={<Text variant="bodyStrong">{menuItemKcal(item)}</Text>}
              last={i === slot.items.length - 1}
            />
          ))}
          {slot.items.length === 0 ? (
            <Text variant="caption" tone="muted">
              Filtrelerine uygun öneri bulunamadı.
            </Text>
          ) : null}
        </Card>
      ))}

      {menu.emptySlots.length > 0 ? (
        <Notice kind="warning" text="Bazı öğünler için filtrelerine uygun yemek bulunamadı. Kişiye özel plan için bir diyetisyene danış." />
      ) : null}
      <Notice kind="success" text="Alerjen içeren yemekler ve alerjen bilgisi eksik yemekler bu listeye girmez." />
      <Notice kind="info" text="Hastalık, hamilelik veya özel bir durumun varsa otomatik liste yerine diyetisyen planı kullan." />

      <View style={{ gap: 10 }}>
        <Button label="Bugüne ekle" size="lg" block icon="add" onPress={addToToday} />
        <Button label="Başka öner" variant="secondary" block icon="refresh" onPress={() => setVariant((v) => v + 1)} />
      </View>
    </View>
  );
}
