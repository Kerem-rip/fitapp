// Diyet önerisi (diyetisyen): danışanın boy, kilo, yaş ve alerjilerine göre TASLAK menü.
// Alerjenli yemekler listeye girmez; alerji bilgisi eksikse öneri hazırlanmaz.
// Taslak, diyetisyen onaylamadan danışana gitmez.
import {
  ALLERGEN_LABELS_TR,
  estimateCalories,
  MEAL_SLOT_LABELS_TR,
  menuItemKcal,
  MIN_DAILY_KCAL,
  SEED_FOODS,
  suggestMenu,
  validateCalorieInput,
  type CalorieNote,
  type MenuSlot,
} from '@fitapp/shared';
import { Button, Card, IconButton, Notice, Screen, ScreenHeader, SectionHeader, showToast, StatTile, Stepper, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { approvePlan } from '@/demo/actions';
import { useAccount, useDemoState } from '@/demo/hooks';
import { ACTIVITY_LABELS, DIET_LABELS, GOAL_LABELS } from '@/demo/labels';
import { activeLinksOf, clientView } from '@/demo/selectors';

const NOTE_TEXT: Record<CalorieNote, string> = {
  floor_applied: 'Hedef güvenli alt sınırda tutuldu.',
  fast_loss_capped: 'Kalori açığı, günlük ihtiyacın %20\'sini geçmeyecek şekilde sınırlandı.',
  underweight_maintain_only: 'BMI düşük olduğu için kilo verme hedefi uygulanmadı.',
  teen_maintain_only: '18 yaş altı için kilo verme hedefi uygulanmaz.',
};

export default function SuggestionScreen() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const account = useAccount();
  const state = useDemoState();
  const [variant, setVariant] = useState(0);
  const [adjust, setAdjust] = useState(0);

  // Çizimler arasında aynı nesne kalsın (menü taslağı sürekli sıfırlanmasın)
  const { link, view } = useMemo(() => {
    const found = account ? activeLinksOf(state, account.id).find((l) => l.clientId === clientId) : undefined;
    return { link: found, view: found ? clientView(state, found.clientId) : undefined };
  }, [state, account, clientId]);

  const input = useMemo(
    () =>
      view
        ? ({
            sex: view.sex,
            ageYears: view.ageYears,
            heightCm: view.heightCm,
            weightKg: view.weightKg,
            activity: view.activity,
            goal: view.goal,
          } as const)
        : null,
    [view],
  );
  const result = useMemo(() => (input && validateCalorieInput(input) === null ? estimateCalories(input) : null), [input]);

  // Hedef kalori: hesaplanan değer ± diyetisyenin ayarı (güvenli alt sınırın altına inemez)
  const floor = view ? MIN_DAILY_KCAL[view.sex] : 1200;
  const target = result ? Math.max(result.target + adjust, result.deltaKcal < 0 ? floor : 0) : 0;

  const generated = useMemo(
    () =>
      view && view.allergens !== null && result
        ? suggestMenu(SEED_FOODS, { targetKcal: target, allergens: view.allergens, diet: view.diet, variant })
        : null,
    [view, result, target, variant],
  );
  const [slots, setSlots] = useState<MenuSlot[]>([]);
  useEffect(() => {
    setSlots(generated?.slots ?? []);
  }, [generated]);

  if (!account) return null;
  if (!view || !link) {
    return (
      <Screen>
        <ScreenHeader title="Diyet önerisi" onBack={() => router.back()} />
        <Notice kind="info" text="Bu danışanın verilerine erişimin yok." />
      </Screen>
    );
  }

  const total = slots.reduce((sum, s) => sum + s.items.reduce((a, i) => a + menuItemKcal(i), 0), 0);

  const setServings = (slotIndex: number, itemIndex: number, servings: number) =>
    setSlots((cur) =>
      cur.map((s, si) =>
        si === slotIndex ? { ...s, items: s.items.map((it, ii) => (ii === itemIndex ? { ...it, servings } : it)) } : s,
      ),
    );
  const removeItem = (slotIndex: number, itemIndex: number) =>
    setSlots((cur) => cur.map((s, si) => (si === slotIndex ? { ...s, items: s.items.filter((_, ii) => ii !== itemIndex) } : s)));

  const approve = () => {
    approvePlan({
      clientId: view.id,
      proId: account.id,
      targetKcal: target,
      menu: slots.map((s) => ({ slot: s.slot, items: s.items.map((i) => ({ foodId: i.food.id, servings: i.servings })) })),
      note: '',
    });
    showToast(`Plan ${view.name} danışanına gönderildi`);
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader title="Diyet önerisi" subtitle={`${view.name} · taslak`} onBack={() => router.back()} />

      {view.allergens === null ? (
        <>
          <Notice kind="danger" title="Alerji bilgisi eksik" text="Güvenlik için alerji bilgisi girilmeden öneri hazırlanmaz. Danışanın sayfasından alerjileri gir ya da 'Alerji yok' seç." />
          <Button label="Danışan sayfasına dön" size="lg" block onPress={() => router.back()} />
        </>
      ) : !result ? (
        <Notice kind="warning" text="Boy, kilo veya yaş bilgisi geçersiz. Danışan sayfasından kontrol et." />
      ) : (
        <>
          <Notice kind="info" title="Taslak" text="Bu liste otomatik hazırlandı. Sen onaylamadan danışana gitmez; düzenleyebilirsin." />

          <Card variant="soft">
            <Text variant="bodyStrong">
              {view.heightCm} cm · {view.weightKg.toLocaleString('tr-TR')} kg · {view.ageYears} yaş
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              {GOAL_LABELS[view.goal]} · {ACTIVITY_LABELS[view.activity]} · {DIET_LABELS[view.diet]}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {view.allergens.length === 0 ? <Tag label="Alerji yok" kind="success" /> : view.allergens.map((a) => <Tag key={a} label={`${ALLERGEN_LABELS_TR[a]} hariç`} kind="danger" />)}
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <StatTile label="Hedef" value={target.toLocaleString('tr-TR')} sub="kcal" icon="flag-outline" />
            <StatTile label="Protein" value={`${result.macros.proteinG} g`} sub={`Karb. ${result.macros.carbsG} · Yağ ${result.macros.fatG}`} icon="nutrition-outline" />
          </View>
          <Card>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
              Hedefi ayarla (günlük ihtiyaç: {result.tdee} kcal)
            </Text>
            <Stepper value={adjust} onChange={setAdjust} min={-300} max={300} step={50} format={(v) => `${v > 0 ? '+' : ''}${v} kcal`} />
          </Card>
          {result.notes.map((n) => (
            <Notice key={n} kind="warning" text={NOTE_TEXT[n]} />
          ))}

          <SectionHeader title={`Taslak menü · ${total} kcal`} />
          {slots.map((slot, si) => (
            <Card key={slot.slot}>
              <Text variant="heading" style={{ marginBottom: 6 }}>
                {MEAL_SLOT_LABELS_TR[slot.slot]}
              </Text>
              {slot.items.map((item, ii) => (
                <View key={item.food.id} style={{ paddingVertical: 8, borderTopWidth: ii === 0 ? 0 : 1, borderTopColor: '#8883' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{item.food.name}</Text>
                      <Text variant="caption" tone="secondary">
                        {item.food.portion} · {menuItemKcal(item)} kcal
                      </Text>
                    </View>
                    <IconButton icon="trash-outline" label="Kaldır" size={36} onPress={() => removeItem(si, ii)} />
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <Stepper value={item.servings} onChange={(v) => setServings(si, ii, v)} min={0.5} max={4} step={0.5} format={(v) => `${v}×`} />
                  </View>
                </View>
              ))}
              {slot.items.length === 0 ? (
                <Text variant="caption" tone="muted">
                  Bu öğün için uygun yemek yok.
                </Text>
              ) : null}
            </Card>
          ))}
          {generated && generated.emptySlots.length > 0 ? (
            <Notice kind="warning" text="Bazı öğünler için filtrelere uygun yemek bulunamadı. Elle düzenlemen gerekebilir." />
          ) : null}
          <Notice kind="success" text="Alerjen içeren ve alerjen bilgisi eksik yemekler listeye girmez." />

          <View style={{ gap: 10 }}>
            <Button label="Onayla ve danışana gönder" size="lg" block icon="checkmark-circle-outline" onPress={approve} />
            <Button label="Başka öner" variant="secondary" block icon="refresh" onPress={() => setVariant((v) => v + 1)} />
          </View>
        </>
      )}
    </Screen>
  );
}
