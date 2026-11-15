// Ana Sayfa: selamlama, bugünün antrenmanı, kısayollar ve günlük ilerleme.
// Her öğe gerçek veriden gelir ve çalışan bir yere gider; olmayan veri (adım gibi) gösterilmez.
import type { CalorieProfileSaved, MyProgramDay, WorkoutCardSummary } from '@fitapp/api-client';
import { Avatar, Icon, IconButton, ProgressBar, Screen, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { SocialMenu } from '@/components/social/SocialMenu';
import { useAccount, useToday } from '@/demo/hooks';
import { LEVEL_TEXT } from '@/features/library/labels';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { useTarget } from '@/features/nutrition/useTarget';
import { HeroImage } from '@/features/workout/CardHero';

const WATER_GOAL_ML = 2000;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

interface Today {
  label: string;
  title: string;
  hero: string;
  meta: string;
  go: () => void;
}

const SHORTCUTS: { icon: IconName; label: string; to: string }[] = [
  { icon: 'barbell-outline', label: 'Antrenman', to: '/library' },
  { icon: 'restaurant-outline', label: 'Beslenme', to: '/nutrition' },
  { icon: 'checkbox-outline', label: 'Görevlerim', to: '/program' },
  { icon: 'people-outline', label: 'Uzmanlar', to: '/discover' },
];

export function HomeScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const account = useAccount();
  const today = useToday();
  const { target: hookTarget, missing: hookMissing } = useTarget();
  const { day: food } = useFoodLog(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mine, setMine] = useState<MyProgramDay | null>(null);
  const [fallback, setFallback] = useState<WorkoutCardSummary | null>(null);
  const [calorie, setCalorie] = useState<CalorieProfileSaved | null>(null);
  const [routineDone, setRoutineDone] = useState<boolean[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.calorieProfile().then((r) => setCalorie(r.profile)).catch(() => setCalorie(null));
      api.routine(today).then((r) => setRoutineDone(r.items.map((i) => i.done))).catch(() => setRoutineDone([]));
      api.notifications(1).then((r) => setUnread(r.unread)).catch(() => setUnread(0));
      api.myProgramDay(today).then(setMine).catch(() => setMine(null));
      api
        .workoutCards()
        .then((r) => setFallback(r.cards.find((x) => x.id === 'quick-10') ?? r.cards[0] ?? null))
        .catch(() => setFallback(null));
    }, [today]),
  );

  if (!account) return null;
  const teen = account.roleKey === 'teen';
  // Kalori aracıyla kaydedilen hedef varsa o kullanılır
  const target = calorie?.targetKcal ?? hookTarget;
  const missing = calorie ? false : hookMissing;

  // Bugünün antrenmanı: önce takvime eklenen kart, sonra katıldığın programın bugünkü günü, yoksa öneri
  const play = (cardId: string, extra: Record<string, string> = {}) => router.push({ pathname: '/workout-play/[id]', params: { id: cardId, ...extra } });
  let hero: Today | null = null;
  const addedCard = mine?.cards.find((x) => !x.done) ?? mine?.cards[0];
  const programDay = mine?.programs.find((p) => p.cardId);
  if (addedCard) {
    hero = { label: 'Bugünkü Antrenman', title: addedCard.card.title, hero: addedCard.hero, meta: `${addedCard.estimatedMinutes} dk · ${addedCard.moveCount} hareket`, go: () => play(addedCard.card.id, { avoid: addedCard.avoid.join(',') }) };
  } else if (programDay?.cardId) {
    hero = {
      label: `${programDay.program.title} · ${programDay.dayIndex + 1}. gün`,
      title: programDay.title,
      hero: programDay.hero ?? 'fullbody',
      meta: `${programDay.steps.length} hareket`,
      go: () => play(programDay.cardId!, { enrollmentId: programDay.enrollmentId, dayIndex: String(programDay.dayIndex) }),
    };
  } else if (fallback) {
    hero = { label: 'Sana önerilen', title: fallback.title, hero: fallback.hero, meta: `${fallback.estimatedMinutes} dk · ${LEVEL_TEXT[fallback.level] ?? fallback.level}`, go: () => router.push({ pathname: '/workout-card/[id]', params: { id: fallback.id } }) };
  }

  // Günlük ilerleme: bugünün görevleri (kart, program adımı, tek hareket, kişisel program)
  const units = mine
    ? [
        ...routineDone,
        ...mine.cards.map((x) => x.done),
        ...mine.programs.flatMap((p) => p.steps.map((s) => s.done)),
        ...mine.tasks.map((t) => t.done),
        ...(mine.personalPlan ? Array.from({ length: mine.personalPlan.progress.plannedMain }, (_, i) => i < mine.personalPlan!.progress.doneMain) : []),
      ]
    : [];
  const doneCount = units.filter(Boolean).length;
  const pct = units.length ? Math.round((doneCount / units.length) * 100) : 0;
  const water = food.waterMl ?? 0;

  return (
    <Screen tabBarInset>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">
            {greeting()}, {account.firstName}
          </Text>
          <Text variant="caption" tone="secondary">
            Hedefine bir adım daha yakınsın.
          </Text>
        </View>
        <IconButton icon="menu-outline" label="Menü" badge={unread} onPress={() => setMenuOpen(true)} />
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profilim" style={{ marginLeft: 8 }}>
          <Avatar name={`${account.firstName} ${account.lastName ?? ''}`.trim()} size={42} />
        </Pressable>
      </View>
      <SocialMenu visible={menuOpen} onClose={() => setMenuOpen(false)} unread={unread} />

      {hero ? (
        <Pressable onPress={hero.go} accessibilityRole="button" accessibilityLabel={`${hero.label}: ${hero.title}`}>
          <HeroImage hero={hero.hero} height={220} />
          <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16, flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {hero.label}
              </Text>
              <Text variant="title" style={{ color: '#FFFFFF' }}>
                {hero.title}
              </Text>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {hero.meta}
              </Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={22} color={accent} />
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 20 }}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s.label} onPress={() => router.push(s.to as never)} accessibilityRole="button" accessibilityLabel={s.label} style={{ alignItems: 'center', width: 76 }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={24} color={accent} />
            </View>
            <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.border, padding: 18 }}>
        <Text variant="heading" style={{ marginBottom: 12 }}>
          Günlük İlerleme
        </Text>
        <Pressable onPress={() => router.push('/program')} accessibilityRole="button" accessibilityLabel="Görevlerim" style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="bodyStrong">Bugünkü görevler</Text>
            <Text variant="bodyStrong" style={{ color: accent }}>
              {units.length ? `${doneCount}/${units.length} · %${pct}` : 'Görev yok'}
            </Text>
          </View>
          <ProgressBar value={doneCount} max={Math.max(units.length, 1)} />
        </Pressable>
        {!teen && !missing ? (
          <Pressable onPress={() => router.push('/nutrition')} accessibilityRole="button" accessibilityLabel="Beslenme" style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text variant="bodyStrong">Kalori (tahmini)</Text>
              <Text variant="caption" tone="secondary">
                {food.totals.kcal} / {target} kcal
              </Text>
            </View>
            <ProgressBar value={food.totals.kcal} max={Math.max(target, 1)} />
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/today')} accessibilityRole="button" accessibilityLabel="Su takibi">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="bodyStrong">Su</Text>
            <Text variant="caption" tone="secondary">
              {(water / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} / {WATER_GOAL_ML / 1000} L
            </Text>
          </View>
          <ProgressBar value={water} max={calorie?.waterMl ?? WATER_GOAL_ML} />
        </Pressable>
      </View>

      {/* Kalori hesaplama aracı: sayfanın en altında; 18 yaş altında kapalıdır */}
      {!teen ? (
        <Pressable onPress={() => router.push('/calorie')} accessibilityRole="button" accessibilityLabel="Kalori hesaplama" style={{ marginTop: 16, backgroundColor: accent, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flame-outline" size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" style={{ color: '#FFFFFF' }}>
              Kalori Hesaplama
            </Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {calorie ? `Hedefin: ${calorie.targetKcal} kcal · Güncellemek için dokun` : 'Amacına göre günlük kalori, protein ve su hedefini hesapla.'}
            </Text>
          </View>
          <Icon name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </Screen>
  );
}
