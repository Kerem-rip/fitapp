// Öğüne yemek ekleme penceresi: arama, porsiyon seçimi, alerjen uyarısı.
import { ALLERGEN_LABELS_TR, MEAL_SLOT_LABELS_TR, SEED_FOODS, type FoodItem, type MealSlot } from '@fitapp/shared';
import { BottomSheet, Button, ListRow, Notice, SearchBar, showToast, Stepper, Tag, Text } from '@fitapp/ui-mobile';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { addMeal } from '@/demo/actions';
import { useAccount, useEnsureConsent, useUserData } from '@/demo/hooks';

export function AddFoodSheet({
  visible,
  slot,
  date,
  hideCalories = false,
  onClose,
}: {
  visible: boolean;
  slot: MealSlot;
  date: string;
  // Genç modunda kalori sayıları gösterilmez
  hideCalories?: boolean;
  onClose: () => void;
}) {
  const account = useAccount();
  const data = useUserData();
  const ensureConsent = useEnsureConsent();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [servings, setServings] = useState(1);

  const foods = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const list = SEED_FOODS.filter((f) => f.slots.includes(slot) || q.length > 0);
    return q ? list.filter((f) => f.name.toLocaleLowerCase('tr-TR').includes(q)) : list;
  }, [query, slot]);

  const close = () => {
    setSelected(null);
    setServings(1);
    setQuery('');
    onClose();
  };

  const myAllergens = selected ? selected.allergens.filter((a) => data.allergens.includes(a)) : [];

  const add = () => {
    if (!account || !selected || !ensureConsent()) return;
    addMeal(account.id, date, { slot, foodId: selected.id, servings });
    showToast(`${selected.name} eklendi`);
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={`${MEAL_SLOT_LABELS_TR[slot]} için yemek ekle`}>
      {selected ? (
        <View>
          <Text variant="heading">{selected.name}</Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
            {hideCalories
              ? selected.portion
              : `${selected.portion} · ${selected.kcal} kcal · Protein ${selected.proteinG} g · Karb. ${selected.carbsG} g · Yağ ${selected.fatG} g`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {selected.allergens.map((a) => (
              <Tag key={a} label={ALLERGEN_LABELS_TR[a]} kind={data.allergens.includes(a) ? 'danger' : 'neutral'} />
            ))}
            {!selected.allergenInfoComplete ? <Tag label="Alerjen bilgisi eksik" kind="warning" /> : null}
          </View>
          {myAllergens.length > 0 ? (
            <Notice kind="danger" title="Alerjen uyarısı" text={`Bu yemek senin alerjin olan içerikleri barındırıyor: ${myAllergens.map((a) => ALLERGEN_LABELS_TR[a]).join(', ')}.`} />
          ) : null}
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
            Porsiyon
          </Text>
          <View style={{ marginBottom: 16 }}>
            <Stepper value={servings} onChange={setServings} min={0.5} max={6} step={0.5} format={(v) => `${v}×`} />
          </View>
          <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
            Değerler tahminidir.
          </Text>
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Button label={hideCalories ? 'Ekle' : `Ekle · ${Math.round(selected.kcal * servings)} kcal`} size="lg" block onPress={add} />
            <Button label="Listeye dön" variant="ghost" block onPress={() => setSelected(null)} />
          </View>
        </View>
      ) : (
        <View>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Yemek ara (ör. mercimek, omlet)" />
          {foods.map((food, i) => (
            <ListRow
              key={food.id}
              icon="restaurant-outline"
              title={food.name}
              subtitle={hideCalories ? food.portion : `${food.portion} · ${food.kcal} kcal`}
              onPress={() => setSelected(food)}
              last={i === foods.length - 1}
            />
          ))}
          {foods.length === 0 ? (
            <Text variant="body" tone="secondary" align="center" style={{ paddingVertical: 24 }}>
              Sonuç bulunamadı.
            </Text>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
