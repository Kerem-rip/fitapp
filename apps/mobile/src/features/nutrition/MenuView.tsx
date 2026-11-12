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
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { useAccount, useEnsureConsent, useToday } from '@/demo/hooks';
import { DIET_LABELS } from '@/demo/labels';
import { useMyNutritionPrefs } from '@/features/health/useMyNutritionPrefs';
import { mealTypeOf } from './AddFoodSheet';
import { useTarget } from './useTarget';

export function MenuView() {
  const account = useAccount();
  const today = useToday();
  const { target: ownTarget, missing } = useTarget();
  // Hedef bilinmiyorsa örnek menü genel bir 2000 kcal üzerinden gösterilir (ekranda yazar)
  const target = missing ? 2000 : ownTarget;
  const ensureConsent = useEnsureConsent();
  const [variant, setVariant] = useState(0);
  const { allergens, diet, saveAllergens, saveDiet } = useMyNutritionPrefs();
  // "Diğer" tercihte menü özel bir kısıt uygulamaz
  const menuDiet: DietPreference = diet === 'other' ? 'none' : diet;

  const menu = useMemo(
    () => suggestMenu(SEED_FOODS, { targetKcal: target, allergens, diet: menuDiet, variant }),
    [target, allergens, menuDiet, variant],
  );

  // Alerji seçimi sağlık öyküsündeki yanıtı günceller (tek kaynak; diyetisyen de aynısını görür)
  const toggleAllergen = async (a: Allergen) => {
    if (!account || !ensureConsent()) return;
    const next = allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a];
    try {
      await saveAllergens(next);
      setVariant(0);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  // Menüdeki her yemek bugünün öğün kaydına eklenir (sunucuda; değerler tahminidir)
  const addToToday = async () => {
    if (!account || !ensureConsent()) return;
    try {
      for (const s of menu.slots) {
        for (const i of s.items) {
          await api.addMeal({
            date: today,
            mealType: mealTypeOf(s.slot),
            foodKey: i.food.id,
            name: i.food.name,
            portion: i.food.portion,
            servings: Math.max(0.5, Math.round(i.servings * 2) / 2),
            perServing: { kcal: i.food.kcal, proteinG: i.food.proteinG, carbsG: i.food.carbsG, fatG: i.food.fatG },
          });
        }
      }
      showToast('Menü bugünkü kayıtlarına eklendi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <View>
      {missing ? <Notice kind="info" text="Boy ve kilon eklenmediği için bu menü genel 2000 kcal üzerinden örneklenmiştir. Profil › Profilini doldur bölümünden eklersen sana göre hesaplanır." /> : null}
      <Text variant="subheading" style={{ marginBottom: 4 }}>
        Alerjilerin
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
        Seçtiklerin menüye hiç girmez. Bu seçim sağlık öyküne kaydedilir; profilindeki ve yemek uyarılarındaki alerjiler de bunlardır.
      </Text>
      <ChipRow wrap options={ALLERGENS.map((key) => ({ key, label: ALLERGEN_LABELS_TR[key] }))} selected={allergens} onToggle={toggleAllergen} />

      <Text variant="subheading" style={{ marginBottom: 8 }}>
        Beslenme tercihin
      </Text>
      <ChipRow
        options={(Object.keys(DIET_LABELS) as DietPreference[]).map((key) => ({ key, label: DIET_LABELS[key] }))}
        selected={diet === 'other' ? [] : [diet]}
        onToggle={async (next) => {
          if (!account || !ensureConsent()) return;
          try {
            await saveDiet(next);
            setVariant(0);
          } catch (e) {
            showToast(errorText(e), 'warning');
          }
        }}
      />
      {diet === 'other' ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          Sağlık öykünde tercihin &quot;Diğer&quot;; örnek menü buna göre ayrıca kısıt uygulamaz.
        </Text>
      ) : null}

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
