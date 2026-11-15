// Kalori aracı: profil bilgilerini onayla → amacını seç → hedefini gör ve kaydet.
// Premium: bel, boyun ve kalça ölçüleriyle TAHMİNİ yağ/kas oranı ve daha doğru kalori hesabı.
// Tüm değerler tahmindir, tıbbi tavsiye değildir. Hesap ortak pakettedir (@fitapp/shared); sunucu güvenlik sınırlarını ayrıca denetler.
import type { CalorieProfileSaved, PremiumState } from '@fitapp/api-client';
import { ageOn, estimateBodyComposition, estimateTool, screenTool, type ActivityLevel, type SportKind, type ToolGoal, type ToolNote, type ToolResult } from '@fitapp/shared';
import { Button, Card, Icon, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { useAccount } from '@/demo/hooks';

const GOALS: { key: ToolGoal; icon: IconName; title: string; text: string }[] = [
  { key: 'lose', icon: 'trending-down-outline', title: 'Kilo vermek', text: 'Haftada en fazla yaklaşık 1 kg' },
  { key: 'maintain', icon: 'scale-outline', title: 'Kilomu korumak', text: 'Günlük ihtiyacın kadar' },
  { key: 'gain', icon: 'trending-up-outline', title: 'Kilo almak', text: 'Sağlıklı bir fazlayla' },
  { key: 'muscle', icon: 'barbell-outline', title: 'Kas kazanmak', text: 'Hafif fazla ve yüksek protein' },
  { key: 'athlete', icon: 'trophy-outline', title: 'Sporcuyum', text: 'Branşına göre ayarlanır' },
  { key: 'breastfeeding', icon: 'heart-outline', title: 'Emzirme dönemi', text: 'Ek enerji; açık verilmez' },
];
const SPORTS: { key: SportKind; label: string }[] = [
  { key: 'gym', label: 'Salon / ağırlık' },
  { key: 'endurance', label: 'Koşu, bisiklet, yüzme' },
  { key: 'team', label: 'Takım sporu' },
  { key: 'combat', label: 'Dövüş sporu' },
  { key: 'other', label: 'Diğer' },
];
const ACTIVITIES: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Hareketsiz' },
  { key: 'light', label: 'Hafif aktif' },
  { key: 'moderate', label: 'Orta aktif' },
  { key: 'active', label: 'Aktif' },
  { key: 'very_active', label: 'Çok aktif' },
];
const MONTHS: { key: string; label: string; months: number }[] = [
  { key: 'm3', label: '0-6 ay', months: 3 },
  { key: 'm9', label: '7-12 ay', months: 9 },
  { key: 'm15', label: '12 ay üstü', months: 15 },
];
const SEX_TEXT = { female: 'Kadın', male: 'Erkek', other: 'Belirtilmemiş' } as const;

const NOTE_TEXT: Record<ToolNote, string> = {
  underweight_maintain_only: 'Vücut kitle indeksin düşük olduğu için kilo verme hedefi uygulanmadı; kilonu koruma hedefi gösteriliyor.',
  floor_applied: 'Günlük hedef, güvenli alt sınırın altına inmesin diye bu değerde tutuldu.',
  weekly_cap: 'Haftalık hedef en fazla yaklaşık 1 kg ile sınırlıdır.',
  breastfeeding_extra: 'Emzirme döneminde ek enerji eklendi. Kilo vermeye çalışmadan önce doktoruna ya da diyetisyenine danış.',
  breastfeeding_floor: 'Emzirme döneminde günlük hedef 1800 kcal altına inmez.',
  katch_used: 'Yağ oranın biliniyor olduğu için hesap yağsız kütleye göre yapıldı.',
};
const BLOCK_TEXT = {
  teen: 'Kalori hedefi 18 yaş ve üzeri içindir.',
  pregnant: 'Hamilelikte kalori hedefi hazırlanmaz; bir doktora ya da diyetisyene danışmanı öneririz.',
  medical: 'Doktorunun beslenme ya da egzersiz kısıtı varsa kalori hedefi hazırlanmaz; doktoruna ya da diyetisyenine danış.',
  eating_disorder: 'Yeme bozukluğu geçmişin varsa kalori hedefi hazırlanmaz; destek için bir uzmana danışmanı öneririz.',
} as const;
const CATEGORY_TEXT = { essential: 'Çok düşük (temel yağ)', athletic: 'Atletik', fit: 'Fit', average: 'Ortalama', high: 'Yüksek' } as const;

const latest = (list: { value: number; takenAt: string; voided: boolean }[]) => list.filter((m) => !m.voided).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]?.value ?? null;

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={hint ?? 'cm'} placeholderTextColor={c.textMuted} accessibilityLabel={label} style={{ backgroundColor: c.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 15, color: c.text }} />
    </View>
  );
}

export function CalorieToolScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const account = useAccount();
  const [step, setStep] = useState<'confirm' | 'goal' | 'result'>('confirm');
  const [meas, setMeas] = useState<{ heightCm: number | null; weightKg: number | null; waist: number | null; neck: number | null; hip: number | null }>({ heightCm: null, weightKg: null, waist: null, neck: null, hip: null });
  const [saved, setSaved] = useState<CalorieProfileSaved | null>(null);
  const [premium, setPremium] = useState<PremiumState | null>(null);
  const [pregnant, setPregnant] = useState(false);
  const [medical, setMedical] = useState(false);
  const [eating, setEating] = useState(false);
  const [goal, setGoal] = useState<ToolGoal | null>(null);
  const [sport, setSport] = useState<SportKind>('gym');
  const [months, setMonths] = useState('m3');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hip, setHip] = useState('');
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        api.myMeasurements({ kind: 'HEIGHT' }).catch(() => []),
        api.myMeasurements({ kind: 'WEIGHT' }).catch(() => []),
        api.myMeasurements({ kind: 'WAIST' }).catch(() => []),
        api.myMeasurements({ kind: 'NECK' }).catch(() => []),
        api.myMeasurements({ kind: 'HIP' }).catch(() => []),
        api.calorieProfile().catch(() => ({ profile: null })),
        api.premium().catch(() => null),
      ]).then(([h, w, wa, ne, hi, p, pr]) => {
        setMeas({ heightCm: latest(h), weightKg: latest(w), waist: latest(wa), neck: latest(ne), hip: latest(hi) });
        setSaved(p.profile);
        setPremium(pr);
        setWaist((v) => v || (latest(wa) !== null ? String(latest(wa)) : ''));
        setNeck((v) => v || (latest(ne) !== null ? String(latest(ne)) : ''));
        setHip((v) => v || (latest(hi) !== null ? String(latest(hi)) : ''));
      });
    }, []),
  );

  const ageYears = account ? ageOn(new Date(account.birthDate)) : 0;
  const sex = account?.sex ?? 'other';
  const complete = !!account && meas.heightCm !== null && meas.weightKg !== null;
  const blocks = screenTool({ ageYears, pregnant, medicalRestriction: medical, eatingDisorderHistory: eating });
  const goalOk = goal !== null && (goal !== 'breastfeeding' || sex !== 'male');

  const result: ToolResult | null = useMemo(() => {
    if (!complete || !goal) return null;
    return estimateTool({
      sex,
      ageYears,
      heightCm: meas.heightCm!,
      weightKg: meas.weightKg!,
      activity,
      goal,
      sport: goal === 'athlete' ? sport : undefined,
      breastfeedingMonths: goal === 'breastfeeding' ? MONTHS.find((m) => m.key === months)!.months : undefined,
      bodyFatPercent: bodyFat,
    });
  }, [complete, goal, sex, ageYears, meas.heightCm, meas.weightKg, activity, sport, months, bodyFat]);

  const save = async () => {
    if (!result || !goal || !complete) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api.saveCalorieProfile({
        goal: result.goal,
        activity,
        ...(goal === 'athlete' ? { sport } : {}),
        ...(goal === 'breastfeeding' ? { breastfeedingMonths: MONTHS.find((m) => m.key === months)!.months } : {}),
        sex,
        ageYears,
        heightCm: meas.heightCm!,
        weightKg: meas.weightKg!,
        ...(bodyFat !== null ? { bodyFatPercent: bodyFat } : {}),
        bmr: result.bmr,
        tdee: result.tdee,
        targetKcal: result.target,
        proteinG: result.macros.proteinG,
        carbsG: result.macros.carbsG,
        fatG: result.macros.fatG,
        waterMl: result.waterMl,
        screening: { pregnant, medicalRestriction: medical, eatingDisorderHistory: eating },
      });
      setSaved(s);
      showToast('Hedefin kaydedildi');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Premium: ölçülerden tahmini yağ/kas oranı
  const body = useMemo(() => {
    const w = Number(waist.replace(',', '.'));
    const n = Number(neck.replace(',', '.'));
    const h = Number(hip.replace(',', '.'));
    if (!complete || !w || !n) return null;
    return estimateBodyComposition({ sex, heightCm: meas.heightCm!, weightKg: meas.weightKg!, waistCm: w, neckCm: n, hipCm: h || null });
  }, [waist, neck, hip, complete, sex, meas.heightCm, meas.weightKg]);

  const useBody = async () => {
    if (!body || typeof body === 'string') return;
    setBusy(true);
    setError(null);
    try {
      const entries: { kind: 'WAIST' | 'NECK' | 'HIP'; value: number }[] = [
        { kind: 'WAIST', value: Number(waist.replace(',', '.')) },
        { kind: 'NECK', value: Number(neck.replace(',', '.')) },
        ...(Number(hip.replace(',', '.')) ? [{ kind: 'HIP' as const, value: Number(hip.replace(',', '.')) }] : []),
      ];
      for (const e of entries) await api.addMyMeasurement({ kind: e.kind, value: e.value, method: 'TAPE' });
      setBodyFat(body.bodyFatPercent);
      showToast('Ölçülerin kaydedildi; hedef yağ oranına göre güncellendi');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const startPremium = async () => {
    try {
      setPremium(await api.setPremium(true));
      showToast('Premium (deneme) açıldı');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const weekly = result ? (result.weeklyChangeKg < -0.05 ? `Haftada yaklaşık ${Math.abs(result.weeklyChangeKg).toLocaleString('tr-TR')} kg vermen beklenir (tahmin)` : result.weeklyChangeKg > 0.05 ? `Haftada yaklaşık ${result.weeklyChangeKg.toLocaleString('tr-TR')} kg almanın beklenir (tahmin)` : 'Kilonu korursun (tahmin)') : '';

  return (
    <Screen>
      <ScreenHeader title="Kalori Hesaplama" subtitle="Hedefin için günlük ihtiyacın" onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {saved && step === 'confirm' ? (
        <Card variant="soft">
          <Text variant="caption" tone="secondary">
            Kayıtlı hedefin
          </Text>
          <Text variant="title">{saved.targetKcal} kcal</Text>
          <Text variant="caption" tone="secondary">
            Protein {saved.proteinG} g · Karbonhidrat {saved.carbsG} g · Yağ {saved.fatG} g · Su {(saved.waterMl / 1000).toLocaleString('tr-TR')} L
          </Text>
        </Card>
      ) : null}

      {/* 1) Profil onayı */}
      {step === 'confirm' ? (
        <>
          <SectionHeader title="Bilgilerini onayla" />
          {complete ? (
            <Card>
              {[
                ['Cinsiyet', SEX_TEXT[sex]],
                ['Yaş', `${ageYears}`],
                ['Boy', `${meas.heightCm} cm`],
                ['Kilo', `${meas.weightKg} kg`],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text variant="body" tone="secondary">
                    {k}
                  </Text>
                  <Text variant="bodyStrong">{v}</Text>
                </View>
              ))}
              <Button label="Bilgilerimi güncelle" variant="ghost" size="sm" onPress={() => router.push('/my-health')} />
            </Card>
          ) : (
            <Notice kind="warning" title="Profilini tamamla" text="Kalori hesabı için boy ve kilonu eklemen gerekiyor." />
          )}
          {!complete ? <Button label="Boy ve kilomu ekle" block onPress={() => router.push('/my-health')} /> : null}

          {complete ? (
            <>
              <SectionHeader title="Birkaç güvenlik sorusu" />
              <Card>
                {[
                  ['Hamile misin?', pregnant, setPregnant],
                  ['Doktorunun beslenme/egzersiz kısıtı var mı? (kalp, diyabet, böbrek, yüksek tansiyon vb.)', medical, setMedical],
                  ['Yeme bozukluğu geçmişin var mı?', eating, setEating],
                ].map(([q, val, set]) => (
                  <View key={q as string} style={{ marginBottom: 10 }}>
                    <Text variant="body" style={{ marginBottom: 6 }}>
                      {q as string}
                    </Text>
                    <ChipRow
                      options={[
                        { key: 'no', label: 'Hayır' },
                        { key: 'yes', label: 'Evet' },
                      ]}
                      selected={[(val as boolean) ? 'yes' : 'no']}
                      onToggle={(k) => (set as (v: boolean) => void)(k === 'yes')}
                    />
                  </View>
                ))}
              </Card>
              {blocks.map((b) => (
                <Notice key={b} kind="warning" text={BLOCK_TEXT[b]} />
              ))}
              {blocks.length === 0 ? <Button label="Bilgilerim doğru, devam et" block onPress={() => setStep('goal')} /> : null}
            </>
          ) : null}
        </>
      ) : null}

      {/* 2) Amaç kartları */}
      {step === 'goal' ? (
        <>
          <SectionHeader title="Amacın ne?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {GOALS.filter((g) => !(g.key === 'breastfeeding' && sex === 'male')).map((g) => {
              const selected = goal === g.key;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setGoal(g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${g.title}. ${g.text}`}
                  style={{ width: '48%', backgroundColor: selected ? accent : c.surface, borderRadius: 20, borderWidth: 1, borderColor: selected ? accent : c.border, padding: 14, minHeight: 112 }}
                >
                  <Icon name={g.icon} size={26} color={selected ? '#FFFFFF' : accent} />
                  <Text variant="bodyStrong" style={{ marginTop: 8, color: selected ? '#FFFFFF' : c.text }}>
                    {g.title}
                  </Text>
                  <Text variant="caption" style={{ color: selected ? 'rgba(255,255,255,0.85)' : c.textSecondary }}>
                    {g.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {goal === 'athlete' ? (
            <>
              <SectionHeader title="Hangi spor?" />
              <ChipRow wrap options={SPORTS} selected={[sport]} onToggle={setSport} />
            </>
          ) : null}
          {goal === 'breastfeeding' ? (
            <>
              <SectionHeader title="Bebeğin kaç aylık?" />
              <ChipRow wrap options={MONTHS} selected={[months]} onToggle={setMonths} />
            </>
          ) : null}
          <SectionHeader title="Günlük hareket düzeyin" />
          <ChipRow wrap options={ACTIVITIES} selected={[activity]} onToggle={setActivity} />
          <Button label="Hesapla" block disabled={!goalOk} onPress={() => setStep('result')} />
          <Button label="Geri" variant="ghost" block onPress={() => setStep('confirm')} />
        </>
      ) : null}

      {/* 3) Sonuç */}
      {step === 'result' && result ? (
        <>
          <Card variant="accent">
            <Text variant="caption" tone="onAccent" style={{ opacity: 0.9 }}>
              Günlük hedefin (tahmini)
            </Text>
            <Text variant="display" tone="onAccent">
              {result.target} kcal
            </Text>
            <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
              {weekly}
            </Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[
              ['Protein', `${result.macros.proteinG} g`],
              ['Karbonhidrat', `${result.macros.carbsG} g`],
              ['Yağ', `${result.macros.fatG} g`],
              ['Su', `${(result.waterMl / 1000).toLocaleString('tr-TR')} L`],
            ].map(([k, v]) => (
              <View key={k} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
                <Text variant="micro" tone="muted">
                  {k}
                </Text>
                <Text variant="bodyStrong">{v}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
            Günlük ihtiyacın (TDEE): {result.tdee} kcal · Bazal: {result.bmr} kcal · VKİ: {result.bmi.toLocaleString('tr-TR')}
          </Text>
          {result.notes.map((n) => (
            <Notice key={n} kind="info" text={NOTE_TEXT[n]} />
          ))}
          <Notice kind="info" text="Değerler tahminidir ve tıbbi tavsiye değildir. Sağlık sorunun varsa bir doktora ya da diyetisyene danış." />
          <Button label={busy ? 'Kaydediliyor…' : saved ? 'Hedefi güncelle' : 'Hedefi kaydet'} block disabled={busy} onPress={save} />
          <Button label="Amacı değiştir" variant="ghost" block onPress={() => setStep('goal')} />

          {/* Premium: detaylı analiz */}
          <SectionHeader title="Detaylı analiz" />
          {premium?.active ? (
            <Card>
              <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
                Çevre ölçülerinle yağ ve kas oranı (tahmini)
              </Text>
              <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
                Zorunlu değil. Mezurayla ölç; değerler birkaç yüzde puan sapabilir.
              </Text>
              <Field label="Bel çevresi (göbek hizası, cm)" value={waist} onChange={setWaist} />
              <Field label="Boyun çevresi (cm)" value={neck} onChange={setNeck} />
              {sex !== 'male' ? <Field label="Kalça çevresi (en geniş yer, cm)" value={hip} onChange={setHip} /> : null}
              {body && typeof body !== 'string' ? (
                <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 16, padding: 12, marginBottom: 10 }}>
                  <Text variant="heading">%{body.bodyFatPercent.toLocaleString('tr-TR')} yağ (tahmini)</Text>
                  <Text variant="caption" tone="secondary">
                    Yağ kütlesi ~{body.fatMassKg} kg · Yağsız kütle ~{body.leanMassKg} kg · Düzey: {CATEGORY_TEXT[body.category]} · Bel/boy: {body.waistToHeight.toLocaleString('tr-TR')}
                  </Text>
                </View>
              ) : body ? (
                <Notice kind="warning" text={body === 'hip_required' ? 'Kalça çevreni de gir.' : body === 'waist_neck' ? 'Bel çevresi boyun çevresinden büyük olmalı.' : 'Girdiğin değerler makul görünmüyor; ölçümlerini kontrol et.'} />
              ) : null}
              <Button label={busy ? 'Kaydediliyor…' : 'Ölçüleri kaydet ve hesabı güncelle'} block disabled={busy || !body || typeof body === 'string'} onPress={useBody} />
            </Card>
          ) : (
            <Card variant="soft">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name="lock-closed-outline" size={18} color={c.earth} />
                <Text variant="bodyStrong">Premium özellik</Text>
              </View>
              <Text variant="body" tone="secondary" style={{ marginBottom: 10 }}>
                Bel, boyun, kalça ölçülerinle tahmini yağ ve kas oranı ve buna göre daha doğru kalori hesabı.
              </Text>
              <Button label="Premium'u dene (deneme)" variant="secondary" onPress={startPremium} />
              <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
                Ödeme henüz aktif değil; deneme yalnızca geliştirme sürümünde açılır.
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
