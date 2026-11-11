// Kayıt öncesi sorular: cevaplar kullanıcının ana sayfasını ve ilk hedefini belirler.
// Kullanıcı tek bir temaya kilitlenmez; hedefini sonradan değiştirebilir.
import { Button, Card, Icon, ProgressBar, Screen, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { setOnboarding } from '@/demo/actions';
import { ONBOARDING_GOAL_LABELS } from '@/demo/labels';
import type { Level, OnboardingAnswers, OnboardingGoal } from '@/demo/types';

interface Option<T extends string> {
  key: T;
  label: string;
  icon: IconName;
  text?: string;
}

const GOALS: Option<OnboardingGoal>[] = [
  { key: 'lose', label: ONBOARDING_GOAL_LABELS.lose, icon: 'trending-down' },
  { key: 'muscle', label: ONBOARDING_GOAL_LABELS.muscle, icon: 'barbell' },
  { key: 'gain', label: ONBOARDING_GOAL_LABELS.gain, icon: 'trending-up' },
  { key: 'maintain', label: ONBOARDING_GOAL_LABELS.maintain, icon: 'fitness' },
  { key: 'posture', label: ONBOARDING_GOAL_LABELS.posture, icon: 'body' },
  { key: 'eating', label: ONBOARDING_GOAL_LABELS.eating, icon: 'leaf' },
  { key: 'face', label: ONBOARDING_GOAL_LABELS.face, icon: 'sparkles' },
];

const PLACES: Option<OnboardingAnswers['place']>[] = [
  { key: 'home', label: 'Evde', icon: 'home', text: 'Ekipmansız veya az ekipmanla' },
  { key: 'gym', label: 'Salonda', icon: 'business', text: 'Ekipmanlı salon' },
  { key: 'both', label: 'İkisi de', icon: 'swap-horizontal' },
  { key: 'none', label: 'Henüz spor yapmıyorum', icon: 'walk', text: 'Sakin başlayalım' },
];

const LEVELS: Option<Level>[] = [
  { key: 'beginner', label: 'Yeni başlıyorum', icon: 'leaf' },
  { key: 'intermediate', label: 'Orta seviye', icon: 'flame' },
  { key: 'advanced', label: 'İleri seviye', icon: 'rocket' },
];

const SUPPORT: Option<OnboardingAnswers['support']>[] = [
  { key: 'dietitian', label: 'Evet, diyetisyen', icon: 'restaurant', text: 'Kişiye özel beslenme planı' },
  { key: 'trainer', label: 'Evet, eğitmen', icon: 'barbell', text: 'Antrenman programı ve takip' },
  { key: 'self', label: 'Şimdilik kendim yaparım', icon: 'person', text: 'Uzmanlara sonra da ulaşabilirsin' },
];

function OptionCard({
  option,
  selected,
  onPress,
}: {
  option: Option<string>;
  selected: boolean;
  onPress: () => void;
}) {
  const { c, accent, accentSoft } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 20,
          marginBottom: 10,
          backgroundColor: selected ? accentSoft : c.surface,
          borderWidth: 2,
          borderColor: selected ? accent : c.border,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selected ? accent : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={option.icon} size={22} color={selected ? '#FFFFFF' : c.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="subheading">{option.label}</Text>
        {option.text ? (
          <Text variant="caption" tone="secondary">
            {option.text}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="checkmark-circle" size={24} color={accent} /> : null}
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<OnboardingGoal[]>([]);
  const [place, setPlace] = useState<OnboardingAnswers['place'] | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [support, setSupport] = useState<OnboardingAnswers['support'] | null>(null);

  const total = 4;
  const canContinue =
    step === 0 ? goals.length > 0 : step === 1 ? place !== null : step === 2 ? level !== null : step === 3 ? support !== null : true;

  const toggleGoal = (g: OnboardingGoal) =>
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const next = () => {
    if (step < total) {
      setStep(step + 1);
      return;
    }
    setOnboarding({ goals, place: place ?? 'home', level: level ?? 'beginner', support: support ?? 'self' });
    router.push('/register');
  };

  const back = () => (step === 0 ? router.back() : setStep(step - 1));

  const titles = ['Hedefin ne?', 'Nerede spor yapmayı seversin?', 'Seviyen nasıl?', 'Bir uzmandan destek ister misin?', 'Sana özel planın hazır'];
  const subtitles = [
    'Birden fazla seçebilirsin. Hedefini sonradan istediğin zaman değiştirebilirsin.',
    'Sana uygun egzersizleri öne çıkaralım.',
    'Sana uygun programları önerelim.',
    'Doğrulanmış diyetisyen ve eğitmenlerle uygulama içinden iletişime geçebilirsin.',
    'Cevaplarına göre ana sayfanı hazırladık.',
  ];

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 8 }}>
        <Pressable onPress={back} hitSlop={10} accessibilityLabel="Geri">
          <Icon name="chevron-back" size={26} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={step + 1} max={total + 1} />
        </View>
        <Text variant="caption" tone="secondary">
          {step + 1}/{total + 1}
        </Text>
      </View>

      <Text variant="title">{titles[step]}</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: 6, marginBottom: 20 }}>
        {subtitles[step]}
      </Text>

      {step === 0 ? GOALS.map((o) => <OptionCard key={o.key} option={o} selected={goals.includes(o.key)} onPress={() => toggleGoal(o.key)} />) : null}
      {step === 1 ? PLACES.map((o) => <OptionCard key={o.key} option={o} selected={place === o.key} onPress={() => setPlace(o.key)} />) : null}
      {step === 2 ? LEVELS.map((o) => <OptionCard key={o.key} option={o} selected={level === o.key} onPress={() => setLevel(o.key)} />) : null}
      {step === 3 ? SUPPORT.map((o) => <OptionCard key={o.key} option={o} selected={support === o.key} onPress={() => setSupport(o.key)} />) : null}

      {step === 4 ? (
        <Card variant="accent">
          <Text variant="heading" tone="onAccent" style={{ marginBottom: 12 }}>
            Senin için hazırladıklarımız
          </Text>
          {goals.map((g) => (
            <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text variant="bodyStrong" tone="onAccent">
                {ONBOARDING_GOAL_LABELS[g]} için kişisel ana sayfa
              </Text>
            </View>
          ))}
          {support !== 'self' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text variant="bodyStrong" tone="onAccent">
                {support === 'dietitian' ? 'Diyetisyen' : 'Eğitmen'} önerileri
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text variant="bodyStrong" tone="onAccent">
              Sana uygun egzersiz programları
            </Text>
          </View>
        </Card>
      ) : null}

      <View style={{ marginTop: 16, gap: 12 }}>
        <Button label={step === total ? 'Hesap oluştur' : 'Devam'} size="lg" block disabled={!canContinue} onPress={next} />
        {step === total ? <Button label="Zaten hesabım var" variant="ghost" size="lg" block onPress={() => router.push('/login')} /> : null}
      </View>
    </Screen>
  );
}
