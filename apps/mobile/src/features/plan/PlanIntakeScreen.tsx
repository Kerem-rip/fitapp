// Kişisel program formu. Gereksiz bilgi istenmez: yaş hesaplanır, boy/kilo ve ölçüler varsa hazır gelir.
// Sağlık soruları cevaplanmadan gönderilemez; riskli ya da belirsiz cevapta program hazırlanmaz, uzmana yönlendirilir.
import type { PlanBodyArea, PlanCatalog, PlanIntakeInput, PlanScreening, ScreeningAnswer } from '@fitapp/api-client';
import { Button, Card, Chip, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { ACTIVITY_LABELS, ANSWER_LABELS, AREA_LABELS, CAPACITY_LABELS, EQUIPMENT_LABELS, EXPERIENCE_LABELS, GOAL_LABELS, SETTING_LABELS, SEX_LABELS } from './labels';

const opts = (labels: Record<string, string>, keys: readonly string[]) => keys.map((key) => ({ key, label: labels[key] ?? key }));
const toNum = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : NaN);

export function PlanIntakeScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [goal, setGoal] = useState<string>('GENERAL_HEALTH');
  const [experience, setExperience] = useState<string>('BEGINNER');
  const [capacity, setCapacity] = useState<string>('MEDIUM');
  const [setting, setSetting] = useState<string>('HOME_NONE');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [days, setDays] = useState('3');
  const [minutes, setMinutes] = useState('40');
  const [activity, setActivity] = useState<string>('LIGHT');
  const [sex, setSex] = useState<string>('other');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [neck, setNeck] = useState('');
  const [arm, setArm] = useState('');
  const [pain, setPain] = useState<string[]>([]);
  const [face, setFace] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ScreeningAnswer>>({});
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanScreening | null>(null);

  useEffect(() => {
    api.planCatalog().then(setCatalog).catch((e) => showToast(errorText(e), 'warning'));
    api
      .planPrefill()
      .then((p) => {
        setSex(p.sex);
        if (p.heightCm) setHeight(String(p.heightCm));
        if (p.weightKg) setWeight(String(p.weightKg));
        if (p.waistCm) setWaist(String(p.waistCm));
        if (p.hipCm) setHip(String(p.hipCm));
        if (p.armCm) setArm(String(p.armCm));
        setNeedsConfirm(p.needsConfirmation);
        // Önceki dönemdeki seçimler öneri olarak gelir; sağlık cevapları her seferinde yeniden verilir
        const last = p.lastIntake?.data;
        if (last) {
          setGoal(last.goal);
          setExperience(last.experience);
          setCapacity(last.capacity);
          setSetting(last.setting);
          setEquipment(last.equipment ?? []);
          setDays(String(last.daysPerWeek));
          setMinutes(String(last.minutesPerSession));
          setActivity(last.dailyActivity);
        }
      })
      .catch(() => undefined);
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) => set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  const questions = catalog?.screeningQuestions ?? [];
  const missing = questions.filter((q) => !answers[q.key]).length;
  const h = toNum(height);
  const w = toNum(weight);
  const valid = h >= 120 && h <= 230 && w >= 30 && w <= 300 && missing === 0;

  const submit = async () => {
    const optional = (s: string) => (toNum(s) > 0 ? toNum(s) : null);
    const input: PlanIntakeInput = {
      goal: goal as PlanIntakeInput['goal'],
      experience: experience as PlanIntakeInput['experience'],
      capacity: capacity as PlanIntakeInput['capacity'],
      setting: setting as PlanIntakeInput['setting'],
      equipment: (setting === 'HOME_EQUIP' ? equipment : []) as PlanIntakeInput['equipment'],
      daysPerWeek: Number(days),
      minutesPerSession: Number(minutes),
      dailyActivity: activity as PlanIntakeInput['dailyActivity'],
      sex: sex as PlanIntakeInput['sex'],
      heightCm: h,
      weightKg: w,
      waistCm: optional(waist),
      hipCm: optional(hip),
      neckCm: optional(neck),
      armCm: optional(arm),
      painAreas: pain as PlanBodyArea[],
      extras: face ? ['FACE_CARE'] : [],
      screening: answers,
    };
    setBusy(true);
    try {
      const r = await api.planSubmitIntake(input);
      if (r.eligible) {
        showToast(r.screening.status === 'CAUTION' ? 'Formun alındı; programın dikkatli hazırlanacak' : 'Formun alındı');
        router.replace('/plan');
      } else setResult(r.screening);
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Screen>
        <ScreenHeader title="Sana uygun program" onBack={() => setResult(null)} />
        <Notice kind="warning" title="Otomatik program hazırlanamadı" text="Güvenliğin için bu durumda bir uzmana danışmanı öneriyoruz." />
        <Card>
          {result.reasons.map((r) => (
            <Text key={r} variant="body" style={{ marginBottom: 6 }}>
              • {r}
            </Text>
          ))}
        </Card>
        {result.referToProfessional ? <Button label="Diyetisyen veya antrenör bul" block onPress={() => router.push('/discover')} /> : null}
        <Button label="Cevaplarımı düzenle" variant="secondary" block onPress={() => setResult(null)} style={{ marginTop: 8 }} />
      </Screen>
    );
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  return (
    <Screen>
      <ScreenHeader title="Kişisel program formu" subtitle="Programın bu bilgilere göre hazırlanır" onBack={back} />
      {needsConfirm ? <Notice kind="info" text="Yeni dönem için ölçülerini ve hedeflerini güncel haline getir. Önceki seçimlerin öneri olarak geldi." /> : null}

      <SectionHeader title="Hedefin" />
      <ChipRow wrap options={opts(GOAL_LABELS, catalog?.options.goals ?? Object.keys(GOAL_LABELS))} selected={[goal]} onToggle={setGoal} />

      <SectionHeader title="Deneyimin ve kapasiten" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
        Egzersiz deneyimin
      </Text>
      <ChipRow wrap options={opts(EXPERIENCE_LABELS, ['NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'])} selected={[experience]} onToggle={setExperience} />
      <Text variant="caption" tone="secondary" style={{ marginVertical: 6 }}>
        Şu anki dayanıklılığın
      </Text>
      <ChipRow wrap options={opts(CAPACITY_LABELS, ['LOW', 'MEDIUM', 'HIGH'])} selected={[capacity]} onToggle={setCapacity} />
      <Text variant="caption" tone="secondary" style={{ marginVertical: 6 }}>
        Günlük hareket düzeyin (antrenman dışında)
      </Text>
      <ChipRow wrap options={opts(ACTIVITY_LABELS, ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE'])} selected={[activity]} onToggle={setActivity} />

      <SectionHeader title="Nerede ve ne kadar?" />
      <ChipRow wrap options={opts(SETTING_LABELS, ['HOME_NONE', 'HOME_EQUIP', 'GYM'])} selected={[setting]} onToggle={setSetting} />
      {setting === 'HOME_EQUIP' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {(catalog?.options.equipment ?? ['DUMBBELL', 'BAND', 'STEP']).map((e) => (
            <Chip key={e} label={EQUIPMENT_LABELS[e] ?? e} selected={equipment.includes(e)} onPress={() => toggle(equipment, setEquipment, e)} />
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="secondary" style={{ marginVertical: 6 }}>
        Haftada kaç gün
      </Text>
      <ChipRow options={['2', '3', '4', '5', '6'].map((d) => ({ key: d, label: `${d} gün` }))} selected={[days]} onToggle={setDays} />
      <Text variant="caption" tone="secondary" style={{ marginVertical: 6 }}>
        Antrenman başına süre
      </Text>
      <ChipRow options={['20', '30', '45', '60', '75'].map((m) => ({ key: m, label: `${m} dk` }))} selected={[minutes]} onToggle={setMinutes} />

      <SectionHeader title="Vücut bilgilerin" />
      <ChipRow options={opts(SEX_LABELS, ['female', 'male', 'other'])} selected={[sex]} onToggle={setSex} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" />
        </View>
      </View>
      <Text variant="caption" tone="muted" style={{ marginBottom: 6 }}>
        İsteğe bağlı çevre ölçüleri (ilerlemeni görmek için; hareket seçimini belirlemez)
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Bel (cm)" value={waist} onChangeText={setWaist} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Kalça (cm)" value={hip} onChangeText={setHip} keyboardType="numeric" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Boyun (cm)" value={neck} onChangeText={setNeck} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Kol (cm)" value={arm} onChangeText={setArm} keyboardType="numeric" />
        </View>
      </View>

      <SectionHeader title="Ağrı ve kısıtlamalar" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
        Zorlanan ya da ağrıyan bölgelerin (o bölgeleri yükleyen hareketler programa alınmaz)
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(AREA_LABELS) as PlanBodyArea[]).map((a) => (
          <Chip key={a} label={AREA_LABELS[a]} selected={pain.includes(a)} onPress={() => toggle(pain, setPain, a)} />
        ))}
      </View>
      <View style={{ marginTop: 10 }}>
        <Chip label="Yüz bakımı da ekle (isteğe bağlı)" selected={face} onPress={() => setFace(!face)} />
      </View>

      <SectionHeader title="Sağlık soruları" />
      <Notice kind="info" text="Bunlar tanı değil, güvenlik kontrolüdür. Evet ya da emin değilim cevabında otomatik program hazırlanmaz; bir uzmana yönlendirilirsin." />
      {questions.map((q) => (
        <Card key={q.key}>
          <Text variant="body" style={{ marginBottom: 8 }}>
            {q.text}
          </Text>
          <ChipRow options={(['YES', 'NO', 'UNSURE'] as const).map((a) => ({ key: a, label: ANSWER_LABELS[a] }))} selected={answers[q.key] ? [answers[q.key]!] : []} onToggle={(a) => setAnswers((prev) => ({ ...prev, [q.key]: a as ScreeningAnswer }))} />
        </Card>
      ))}

      {missing > 0 ? (
        <Text variant="caption" tone="warning" style={{ marginBottom: 8 }}>
          {missing} sağlık sorusu cevaplanmadı.
        </Text>
      ) : null}
      <Button label={busy ? 'Gönderiliyor…' : 'Formu gönder'} block onPress={submit} disabled={!valid || busy} />
    </Screen>
  );
}
