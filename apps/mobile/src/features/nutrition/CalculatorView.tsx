// Kalori hesaplayıcı: boy, kilo, yaş ve hareket düzeyinden günlük ihtiyaç ve hedefe göre kalori.
// Hesaplama packages/shared'dadır (testlidir); güvenlik sınırları orada uygulanır.
import { estimateCalories, MIN_DAILY_KCAL, validateCalorieInput, type ActivityLevel, type CalorieNote, type Goal } from '@fitapp/shared';
import { Button, Card, Notice, SectionHeader, showToast, StatTile, TextField, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { updateHealth } from '@/demo/actions';
import { ACTIVITY_LABELS, GOAL_LABELS } from '@/demo/labels';
import { useAccount, useEnsureConsent, useUserData } from '@/demo/hooks';
import { useTarget } from './useTarget';

const GOAL_TIPS: Record<Goal, string[]> = {
  lose: [
    'Haftada en fazla 0,5 kg vermeyi hedefle.',
    'Her öğüne bir protein kaynağı ekle; daha uzun tok kalırsın.',
    'Günde en az 2 litre su iç.',
    'Ani kısıtlamalar yerine porsiyonları biraz küçült.',
  ],
  gain: [
    'Öğün sayını artır, ara öğünleri atlama.',
    'Zeytinyağı, yağlı tohumlar ve süt ürünleri enerji katar.',
    'Kilo almayı yavaş ve düzenli hedefle.',
  ],
  muscle: [
    'Proteini gün içine yay.',
    'Antrenmandan sonra karbonhidrat ve protein birlikte al.',
    'Uyku ve dinlenme, kas gelişimi için antrenman kadar önemlidir.',
  ],
  maintain: ['Öğünlerini düzenli tut.', 'Kilonu haftada bir takip et.', 'Hareketli kalmaya devam et.'],
};

const NOTE_TEXT: Record<CalorieNote, (sex: 'female' | 'male' | 'other') => string> = {
  floor_applied: (sex) =>
    `Hedef, güvenli alt sınır olan ${MIN_DAILY_KCAL[sex]} kcal'de tutuldu. Daha düşük bir hedef için mutlaka bir diyetisyene danış.`,
  fast_loss_capped: () => 'Kalori açığı, günlük ihtiyacının %20\'sini geçmeyecek şekilde sınırlandı.',
  underweight_maintain_only: () => 'BMI değerin düşük göründüğü için kilo verme hedefi uygulanmadı. Bir uzmana danışmanı öneririz.',
  teen_maintain_only: () => '18 yaş altı için kilo verme hedefi uygulanmaz.',
};

const num = (text: string) => Number(text.replace(',', '.'));

export function CalculatorView() {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  const { ageYears } = useTarget();
  const ensureConsent = useEnsureConsent();
  const [goal, setGoal] = useState<Goal>(data.goal);
  const [activity, setActivity] = useState<ActivityLevel>(data.activity);
  const [height, setHeight] = useState(String(data.heightCm));
  const [weight, setWeight] = useState(String(data.weightKg));

  const input = useMemo(
    () => ({ sex: account?.sex ?? 'other', ageYears, heightCm: num(height), weightKg: num(weight), activity, goal }) as const,
    [account?.sex, ageYears, height, weight, activity, goal],
  );
  const error = validateCalorieInput(input);
  const result = useMemo(() => (error === null ? estimateCalories(input) : null), [error, input]);

  const errorText =
    error === 'height' ? 'Boyu 120-230 cm arasında gir' : error === 'weight' ? 'Kiloyu 30-300 kg arasında gir' : error === 'age' ? 'Yaş 13-99 arasında olmalı' : undefined;

  const save = () => {
    if (!account || !result || !ensureConsent()) return;
    updateHealth(account.id, { heightCm: input.heightCm, weightKg: input.weightKg, activity, goal: result.goal, targetKcal: result.target });
    showToast('Günlük hedefin kaydedildi');
  };

  return (
    <View>
      <Text variant="subheading" style={{ marginBottom: 8 }}>
        Hedefin ne?
      </Text>
      <ChipRow
        options={(Object.keys(GOAL_LABELS) as Goal[]).map((key) => ({ key, label: GOAL_LABELS[key] }))}
        selected={[goal]}
        onToggle={setGoal}
      />

      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" error={error === 'height' ? errorText : undefined} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" error={error === 'weight' ? errorText : undefined} />
          </View>
        </View>
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Yaş: {ageYears} (doğum tarihinden) · Hareket düzeyi
        </Text>
        <ChipRow
          wrap
          options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => ({ key, label: ACTIVITY_LABELS[key] }))}
          selected={[activity]}
          onToggle={setActivity}
        />
      </Card>

      {result ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <StatTile label="Günlük ihtiyaç" value={result.tdee.toLocaleString('tr-TR')} sub="kcal (tahmini)" icon="flame-outline" />
            <StatTile label="Hedefin" value={result.target.toLocaleString('tr-TR')} sub="kcal" icon="flag-outline" />
          </View>
          <Card variant="soft">
            <Text variant="bodyStrong">Haftalık değişim: {result.weeklyChangeKg > 0 ? '+' : ''}{result.weeklyChangeKg.toLocaleString('tr-TR')} kg</Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              Protein {result.macros.proteinG} g · Karbonhidrat {result.macros.carbsG} g · Yağ {result.macros.fatG} g · BMI {result.bmi.toLocaleString('tr-TR')}
            </Text>
          </Card>
          {result.notes.map((note) => (
            <Notice key={note} kind="warning" text={NOTE_TEXT[note](input.sex)} />
          ))}

          <SectionHeader title={`${GOAL_LABELS[result.goal]} için ipuçları`} />
          <Card>
            {GOAL_TIPS[result.goal].map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <Text variant="bodyStrong" tone="accent">
                  •
                </Text>
                <Text variant="body" style={{ flex: 1 }}>
                  {tip}
                </Text>
              </View>
            ))}
          </Card>

          <Notice kind="info" text="Bu değerler tahmindir. Hamilelik, hastalık veya ilaç kullanımında mutlaka diyetisyen veya doktora danış." />
          <View style={{ gap: 10 }}>
            <Button label="Bunu günlük hedefim yap" size="lg" block onPress={save} />
            <Button label="Kişiye özel plan için diyetisyen bul" variant="ghost" block onPress={() => router.push('/discover')} />
          </View>
        </>
      ) : (
        <Notice kind="warning" text={errorText ?? 'Bilgilerini kontrol et.'} />
      )}
    </View>
  );
}
