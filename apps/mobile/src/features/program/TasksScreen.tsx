// Görevlerim: günün tüm görevleri madde madde; her birinin yanında yuvarlak işaretleme yeri. Hepsi bitince sayfa sonunda "Tüm görevler tamamlandı".
// Kaynaklar etiketle ayrı kalır (programlar, antrenman kartları, uzman planı, kendi görevlerin). "Uzmanından" ayrı bölümü yoktur: uzman görevleri aynı listededir.
// Premium (profil tamamlanmışsa): sabah/öğle/ikindi/akşam rutinleri; kişisel bakım, egzersiz ve yemek şeritleri AYRI gösterilir, öneriler seçenek olarak gelir.
// Ücretsiz kullanıcı kendi görevlerini ekler; öneri çıkmaz.
import type { CalorieProfileSaved, MyPlanView, MyProgramDay, MyProgramListItem, PremiumState, RoutineDay, RoutineItemView, RoutineLaneKey, RoutineSlotKey, WorkoutCardSummary } from '@fitapp/api-client';
import { LANE_LABELS, routineOptions, SLOT_INFO, type RoutineOption } from '@fitapp/shared';
import { Button, Card, Icon, IconButton, Notice, Screen, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { SocialHeader } from '@/components/social/SocialHeader';
import { DAY_SHORT, dateKey, dayNumber, formatLong, weekdayIndex } from '@/demo/dates';
import { useAccount } from '@/demo/hooks';
import { durationText } from '@/features/library/labels';

const DAYS = Array.from({ length: 14 }, (_, i) => dateKey(i - 3));
const SLOT_KEY: Record<string, RoutineSlotKey> = { morning: 'MORNING', noon: 'NOON', afternoon: 'AFTERNOON', evening: 'EVENING' };
const LANE_KEY: Record<string, RoutineLaneKey> = { care: 'CARE', exercise: 'EXERCISE', meal: 'MEAL' };
const LANES: { key: RoutineLaneKey; label: string; icon: 'sparkles-outline' | 'barbell-outline' | 'restaurant-outline' }[] = [
  { key: 'CARE', label: LANE_LABELS.care, icon: 'sparkles-outline' },
  { key: 'EXERCISE', label: LANE_LABELS.exercise, icon: 'barbell-outline' },
  { key: 'MEAL', label: LANE_LABELS.meal, icon: 'restaurant-outline' },
];

type Meal = MyPlanView['meals'][number] & { planId: string };

interface Task {
  key: string;
  title: string;
  subtitle?: string;
  done: boolean;
  // İşaretleme (yoksa yuvarlağa dokununca satır açılır)
  toggle?: () => Promise<void>;
  open?: () => void;
  action?: { label: string; onPress: () => void };
  remove?: () => Promise<void>;
}

function Circle({ done, disabled, onPress, label }: { done: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  const { c, accent } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled }} accessibilityLabel={label} hitSlop={10}>
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={done ? accent : disabled ? c.border : c.textMuted} />
    </Pressable>
  );
}

function TaskRow({ t, disabled }: { t: Task; disabled: boolean }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (!t.toggle) return t.open?.();
    setBusy(true);
    try {
      await t.toggle();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Circle done={t.done} disabled={disabled || busy} onPress={press} label={t.title} />
      <Pressable style={{ flex: 1 }} onPress={t.open} accessibilityRole={t.open ? 'button' : undefined}>
        <Text variant="bodyStrong" style={t.done ? { textDecorationLine: 'line-through', color: c.textMuted } : undefined}>
          {t.title}
        </Text>
        {t.subtitle ? (
          <Text variant="caption" tone="secondary">
            {t.subtitle}
          </Text>
        ) : null}
      </Pressable>
      {t.action && !t.done ? <Button label={t.action.label} size="sm" variant="secondary" onPress={t.action.onPress} disabled={disabled} /> : null}
      {t.remove ? <IconButton icon="close" label={`${t.title} görevini kaldır`} size={32} onPress={() => void t.remove!()} /> : null}
    </View>
  );
}

export function TasksScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const account = useAccount();
  const today = dateKey(0);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<MyProgramDay | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [trainer, setTrainer] = useState<MyProgramListItem[]>([]);
  const [routine, setRoutine] = useState<RoutineDay | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [profile, setProfile] = useState<CalorieProfileSaved | null>(null);
  const [premium, setPremium] = useState<PremiumState | null>(null);
  const [cards, setCards] = useState<WorkoutCardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [lane, setLane] = useState<RoutineLaneKey>('EXERCISE');
  const [openLane, setOpenLane] = useState<string | null>(null);
  const future = date > today;

  const load = useCallback(async (d: string) => {
    try {
      const [mine, planList, programList, rt, ck, prof, prem, cardList] = await Promise.all([
        api.myProgramDay(d),
        api.myPlans(),
        api.myPrograms(),
        api.routine(d),
        api.taskChecks(d),
        api.calorieProfile().catch(() => ({ profile: null })),
        api.premium().catch(() => null),
        api.workoutCards().catch(() => ({ cards: [] as WorkoutCardSummary[] })),
      ]);
      const views = await Promise.all(planList.map((p) => api.myPlan(p.planId, d)));
      setDay(mine);
      setMeals(views.flatMap((v) => v.meals.map((m) => ({ ...m, planId: v.planId }))).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')));
      setTrainer(programList);
      setRoutine(rt);
      setChecks(ck.keys);
      setProfile(prof.profile);
      setPremium(prem);
      setCards(cardList.cards);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(date);
    }, [load, date]),
  );

  const run = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      await load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const check = (key: string, done: boolean) => run(() => api.setTaskCheck(key, date, !done));
  const play = (cardId: string, extra: Record<string, string> = {}) => router.push({ pathname: '/workout-play/[id]', params: { id: cardId, ...extra } });

  // ── Liste: kaynaklara göre bölümler ──
  const sections = useMemo(() => {
    const out: { title: string; tasks: Task[]; header?: { label: string; onPress: () => void } }[] = [];
    if (!day) return out;
    const pp = day.personalPlan;
    if (pp) {
      out.push({
        title: `Kişisel program · ${pp.weekNumber}. hafta, ${pp.dayNumber}. gün`,
        tasks: pp.entries.map((e) => ({ key: `pp:${e.index}`, title: e.title, subtitle: e.workText, done: e.status === 'DONE', open: () => router.push(`/plan-day/${pp.source.instanceId}/${pp.dayNumber}`) })),
      });
    }
    for (const p of day.programs) {
      out.push({
        title: `${p.program.title} · ${p.dayIndex + 1}. gün`,
        header: p.cardId ? { label: 'Hemen Başla', onPress: () => play(p.cardId!, { enrollmentId: p.enrollmentId, dayIndex: String(p.dayIndex) }) } : undefined,
        tasks: p.steps.map((s) => ({
          key: `step:${p.enrollmentId}:${s.index}`,
          title: s.item.title,
          subtitle: `${s.workText} · ~${durationText(s.durationSec)}`,
          done: s.done,
          open: () => router.push(`/library-item/${s.item.id}`),
          toggle: run(() => api.setLibraryStep(p.enrollmentId, p.dayIndex, s.index, !s.done)),
        })),
      });
    }
    if (day.cards.length) {
      out.push({
        title: 'Antrenman kartları',
        tasks: day.cards.map((t) => ({
          key: `card:${t.id}`,
          title: t.card.title,
          subtitle: t.done ? `${t.completedMoves ?? 0}/${t.totalMoves ?? t.moveCount} hareket yapıldı` : `~${t.estimatedMinutes} dk · ${t.moveCount} hareket`,
          done: t.done,
          open: () => router.push({ pathname: '/workout-card/[id]', params: { id: t.card.id, avoid: t.avoid.join(',') } }),
          action: { label: 'Hemen Başla', onPress: () => play(t.card.id, { avoid: t.avoid.join(',') }) },
          toggle: run(() => (t.done ? api.resetWorkoutCardTask(t.id) : api.completeWorkoutCard(t.card.id, t.moveCount, t.moveCount, t.avoid))),
          remove: run(() => api.removeWorkoutCardTask(t.id)),
        })),
      });
    }
    if (day.tasks.length) {
      out.push({
        title: 'Eklediğin hareketler',
        tasks: day.tasks.map((t) => ({
          key: `task:${t.id}`,
          title: t.item.title,
          subtitle: `${t.workText} · ~${durationText(t.durationSec)}`,
          done: t.done,
          open: () => router.push(`/library-item/${t.item.id}`),
          toggle: run(() => api.setLibraryTaskDone(t.id, !t.done)),
          remove: run(() => api.removeLibraryTask(t.id)),
        })),
      });
    }
    if (meals.length) {
      out.push({
        title: 'Diyetisyen planı',
        tasks: meals.map((m) => {
          const key = `plan:${m.planId}:${m.id}`;
          const done = checks.includes(key);
          return {
            key,
            title: m.time ? `${m.time} · ${m.name}` : m.name,
            subtitle: m.chosen.length ? m.options.filter((o) => m.chosen.includes(o.id)).map((o) => o.name).join(', ') : m.options.length > 1 ? `${m.options.length} seçenekten ${m.pick} tanesini seç` : m.options[0]?.name,
            done,
            open: () => router.push(`/my-plan/${m.planId}`),
            toggle: check(key, done),
          };
        }),
      });
    }
    if (trainer.length) {
      out.push({
        title: 'Antrenör programı',
        tasks: trainer.map((p) => {
          const key = `prog:${p.programId}`;
          const done = checks.includes(key);
          return { key, title: p.title ?? 'Antrenman programı', subtitle: `${p.professional.title ? `${p.professional.title} ` : ''}${p.professional.name}`, done, open: () => router.push(`/my-program/${p.programId}`), toggle: check(key, done) };
        }),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, meals, trainer, checks, date]);

  // ── Rutin öğeleri (kendi görevlerin ve premium rutinleri) ──
  const routineTask = (r: RoutineItemView): Task => {
    const items = r.data?.items;
    const kcal = items?.reduce((s, i) => s + i.kcal, 0);
    return {
      key: `routine:${r.id}`,
      title: r.title,
      subtitle: items ? `${items.map((i) => i.name).join(', ')} · ~${Math.round(kcal ?? 0)} kcal` : (r.subtitle ?? undefined),
      done: r.done,
      toggle: run(() => api.setRoutineDone(r.id, !r.done)),
      remove: run(() => api.removeRoutine(r.id)),
      action: r.kind === 'CARD' && r.refId ? { label: 'Başla', onPress: () => play(r.refId!) } : undefined,
      open: r.kind === 'CARD' && r.refId ? () => router.push({ pathname: '/workout-card/[id]', params: { id: r.refId! } }) : undefined,
    };
  };
  const plannerOn = !!premium?.active && !!profile;
  const slotted = plannerOn ? (routine?.items ?? []).filter((r) => r.slot !== 'ANYTIME') : [];
  const own = (routine?.items ?? []).filter((r) => !slotted.includes(r));

  const allTasks: Task[] = [...sections.flatMap((s) => s.tasks), ...own.map(routineTask), ...slotted.map(routineTask)];
  const doneCount = allTasks.filter((t) => t.done).length;
  const allDone = allTasks.length > 0 && doneCount === allTasks.length;

  // Premium öneriler: profil bilgilerine göre
  const suggestions: RoutineOption[] = useMemo(() => {
    if (!plannerOn || !profile) return [];
    return routineOptions({ sex: profile.sex, goal: profile.goal, sport: profile.sport, targetKcal: profile.targetKcal });
  }, [plannerOn, profile]);

  const optionTitle = (o: RoutineOption) => (o.lane === 'exercise' ? (cards.find((x) => x.id === o.refId)?.title ?? o.title) : o.title);

  const addOption = async (o: RoutineOption) => {
    const card = o.refId ? cards.find((x) => x.id === o.refId) : undefined;
    const subtitle = o.lane === 'exercise' && card ? `~${card.estimatedMinutes} dk · ${card.moveCount} hareket` : o.subtitle;
    try {
      await api.addRoutine({
        date,
        slot: SLOT_KEY[o.slot]!,
        lane: LANE_KEY[o.lane]!,
        kind: o.kind,
        refId: o.refId,
        title: optionTitle(o),
        subtitle,
        data: o.items ? { items: o.items.map((i) => ({ name: i.name, portion: i.portion, servings: i.servings, kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })) } : undefined,
        source: 'SUGGESTED',
      });
      await load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const addOwn = async () => {
    const title = text.trim();
    if (!title) return;
    try {
      await api.addRoutine({ date, slot: 'ANYTIME', lane, kind: 'CUSTOM', title, source: 'MANUAL' });
      setText('');
      await load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
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

  return (
    <Screen tabBarInset>
      <SocialHeader title="Görevlerim" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {DAYS.map((d) => {
          const selected = d === date;
          return (
            <Pressable key={d} onPress={() => setDate(d)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={formatLong(d)} style={{ width: 48, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: selected ? accent : c.surface, borderWidth: 1, borderColor: selected ? accent : c.border }}>
              <Text variant="micro" style={{ color: selected ? '#FFFFFF' : c.textMuted }}>
                {d === today ? 'Bugün' : DAY_SHORT[weekdayIndex(d)]}
              </Text>
              <Text variant="bodyStrong" style={{ color: selected ? '#FFFFFF' : c.text }}>
                {dayNumber(d)}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ width: 8 }} />
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
        <Text variant="caption" tone="secondary">
          {formatLong(date)}
        </Text>
        {allTasks.length ? (
          <Text variant="caption" tone="secondary">
            {doneCount}/{allTasks.length} tamam
          </Text>
        ) : null}
      </View>
      {error ? <Notice kind="danger" text={error} /> : null}
      {future && allTasks.length ? <Notice kind="info" text="Gelecek günün görevlerini o gün geldiğinde işaretleyebilirsin." /> : null}

      {/* Görev listesi */}
      {sections.map((s) => (
        <Card key={s.title}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {s.title}
            </Text>
            {s.header ? <Button label={s.header.label} size="sm" icon="play-circle-outline" onPress={s.header.onPress} disabled={future} /> : null}
          </View>
          {s.tasks.map((t) => (
            <TaskRow key={t.key} t={t} disabled={future} />
          ))}
        </Card>
      ))}

      {/* Kendi görevlerin (ücretsiz: önerisiz) */}
      <Card>
        <Text variant="bodyStrong">Kendi görevlerim</Text>
        {own.map((r) => (
          <TaskRow key={r.id} t={routineTask(r)} disabled={future} />
        ))}
        {own.length === 0 ? (
          <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>
            Yapmak istediğin bir şeyi ekle: hareket, bakım ya da öğün.
          </Text>
        ) : null}
        <ChipRow options={LANES.map((l) => ({ key: l.key, label: l.label }))} selected={[lane]} onToggle={setLane} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput value={text} onChangeText={setText} onSubmitEditing={addOwn} placeholder="Görev ekle" placeholderTextColor={c.textMuted} accessibilityLabel="Görev ekle" maxLength={120} style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 15, color: c.text }} />
          <Button label="Ekle" size="sm" onPress={addOwn} disabled={!text.trim()} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button label="Egzersiz seç" size="sm" variant="ghost" onPress={() => router.push('/library')} />
          <Button label="Öğün kaydet" size="sm" variant="ghost" onPress={() => router.push('/nutrition')} />
        </View>
      </Card>

      {/* Premium: günün düzeni */}
      {premium?.active ? (
        profile ? (
          SLOT_INFO.map((slot) => {
            const slotKey = SLOT_KEY[slot.key]!;
            return (
              <Card key={slot.key}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text variant="heading">{slot.label}</Text>
                  <Text variant="caption" tone="muted">
                    {slot.time}
                  </Text>
                </View>
                {LANES.map((l) => {
                  const items = slotted.filter((r) => r.slot === slotKey && r.lane === l.key);
                  const laneId = `${slot.key}:${l.key}`;
                  const opts = suggestions.filter((o) => o.slot === slot.key && LANE_KEY[o.lane] === l.key && !items.some((i) => (o.kind === 'FOOD' ? i.subtitle?.startsWith(o.subtitle ?? '\u0000') : i.title === optionTitle(o))));
                  return (
                    <View key={l.key} style={{ marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name={l.icon} size={16} color={c.textSecondary} />
                        <Text variant="micro" tone="muted" style={{ letterSpacing: 1 }}>
                          {l.label.toLocaleUpperCase('tr')}
                        </Text>
                      </View>
                      {items.map((r) => (
                        <TaskRow key={r.id} t={routineTask(r)} disabled={future} />
                      ))}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <Button label={openLane === laneId ? 'Önerileri gizle' : 'Öneriler'} size="sm" variant="secondary" onPress={() => setOpenLane(openLane === laneId ? null : laneId)} />
                        {l.key === 'MEAL' ? <Button label="Kendi öğünümü gir" size="sm" variant="ghost" onPress={() => router.push('/nutrition')} /> : null}
                        {l.key === 'EXERCISE' ? <Button label="Kendi egzersizimi seç" size="sm" variant="ghost" onPress={() => router.push('/library')} /> : null}
                      </View>
                      {openLane === laneId
                        ? opts.slice(0, 4).map((o) => {
                            const card = o.refId ? cards.find((x) => x.id === o.refId) : undefined;
                            return (
                              <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surfaceAlt, borderRadius: 16, padding: 12, marginTop: 8 }}>
                                <View style={{ flex: 1 }}>
                                  <Text variant="bodyStrong">{optionTitle(o)}</Text>
                                  <Text variant="caption" tone="secondary">
                                    {o.nutrients ? `${o.subtitle} · ${o.nutrients.kcal} kcal · P ${o.nutrients.proteinG} g · K ${o.nutrients.carbsG} g · Y ${o.nutrients.fatG} g (tahmini)` : o.lane === 'exercise' && card ? `~${card.estimatedMinutes} dk · ${card.moveCount} hareket` : o.subtitle}
                                  </Text>
                                </View>
                                <Button label="Ekle" size="sm" onPress={() => void addOption(o)} />
                              </View>
                            );
                          })
                        : null}
                      {openLane === laneId && opts.length === 0 ? (
                        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
                          Bu şerit için başka öneri kalmadı.
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            );
          })
        ) : (
          <Card variant="soft">
            <Text variant="bodyStrong">Günün düzeni için profilini tamamla</Text>
            <Text variant="caption" tone="secondary" style={{ marginVertical: 6 }}>
              Boy, kilo, yaş ve cinsiyetini onaylayıp amacını seçince sabah, öğle ve akşam için sana uygun öneriler gelir.
            </Text>
            <Button label="Kalori hesaplamaya git" size="sm" onPress={() => router.push('/calorie')} />
          </Card>
        )
      ) : premium && account?.roleKey !== 'teen' ? (
        <Card variant="soft">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="lock-closed-outline" size={18} color={c.earth} />
            <Text variant="bodyStrong">Günün düzeni (Premium)</Text>
          </View>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
            Sabah, öğle ve akşam rutinleri: kişisel bakım, egzersiz ve yemek önerileri (besin değerleriyle). Seçersin ya da kendi öğününü girersin.
          </Text>
          <Button label="Premium'u dene (deneme)" size="sm" variant="secondary" onPress={startPremium} />
        </Card>
      ) : null}

      {/* Sayfa sonu: tamamlama onayı ve gün sonu analizi */}
      {allDone ? (
        <Card variant="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="checkmark-circle" size={28} color="#FFFFFF" />
            <Text variant="heading" tone="onAccent">
              Tüm görevler tamamlandı
            </Text>
          </View>
        </Card>
      ) : allTasks.length === 0 ? (
        <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>
          Bu gün için görev yok. Yukarıdan kendi görevini ekleyebilir ya da Kütüphane'den bir antrenman seçebilirsin.
        </Text>
      ) : null}
      <Button label="Günün analizini gör" icon="analytics-outline" variant="secondary" block onPress={() => router.push({ pathname: '/day-analysis', params: { date } })} />
    </Screen>
  );
}
