// Programım: seçilen günün yapılacakları.
// "Uzmanından": diyetisyenin planındaki öğünler (sabah/öğle/akşam, saatiyle) ve antrenörün programı.
// "Görevlerim": katıldığı ücretsiz programın o günkü hareketleri sırayla (süre ve dinlenmeyle) ve tek tek eklenen hareketler.
import type { MyPlanListItem, MyPlanView, MyProgramDay, MyProgramListItem } from '@fitapp/api-client';
import { Button, Card, EmptyState, Icon, ListRow, Notice, Screen, SectionHeader, showToast, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { SocialHeader } from '@/components/social/SocialHeader';
import { DAY_SHORT, dateKey, dayNumber, formatLong, weekdayIndex } from '@/demo/dates';
import { durationText } from '@/features/library/labels';
import { SOURCE_TAG } from '@/features/plan/labels';

// Bugünden 3 gün öncesi ile 10 gün sonrası
const DAYS = Array.from({ length: 14 }, (_, i) => dateKey(i - 3));

type Meal = MyPlanView['meals'][number] & { planId: string };

// Öğün saatine göre bölüm; saati olmayanlar "Gün içinde"
function slotOf(time: string | null): string {
  if (!time) return 'Gün içinde';
  const hour = Number(time.slice(0, 2));
  return hour < 11 ? 'Sabah' : hour < 17 ? 'Öğle' : 'Akşam';
}
const SLOT_ORDER = ['Sabah', 'Öğle', 'Akşam', 'Gün içinde'];

function Check({ done, disabled, onPress, label }: { done: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  const { c, accent } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled }} accessibilityLabel={label} hitSlop={8}>
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done ? accent : disabled ? c.border : c.textMuted} />
    </Pressable>
  );
}

export function MyProgramScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const today = dateKey(0);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<MyProgramDay | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plans, setPlans] = useState<MyPlanListItem[]>([]);
  const [trainerPrograms, setTrainerPrograms] = useState<MyProgramListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const future = date > today;

  const load = useCallback(async (d: string) => {
    try {
      const [mine, planList, programList] = await Promise.all([api.myProgramDay(d), api.myPlans(), api.myPrograms()]);
      const views = await Promise.all(planList.map((p) => api.myPlan(p.planId, d)));
      setDay(mine);
      setPlans(planList);
      setTrainerPrograms(programList);
      setMeals(views.flatMap((v) => v.meals.map((m) => ({ ...m, planId: v.planId }))));
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

  const toggleStep = async (enrollmentId: string, dayIndex: number, stepIndex: number, done: boolean) => {
    try {
      await api.setLibraryStep(enrollmentId, dayIndex, stepIndex, done);
      void load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const toggleTask = async (id: string, done: boolean) => {
    try {
      await api.setLibraryTaskDone(id, done);
      void load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const removeTask = async (id: string) => {
    try {
      await api.removeLibraryTask(id);
      void load(date);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const slots = SLOT_ORDER.map((slot) => ({
    slot,
    meals: meals.filter((m) => slotOf(m.time) === slot).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
  })).filter((s) => s.meals.length > 0);
  const hasExpert = plans.length > 0 || trainerPrograms.length > 0;
  const hasTasks = (day?.programs.length ?? 0) + (day?.tasks.length ?? 0) + (day?.personalPlan ? 1 : 0) > 0;

  return (
    <Screen tabBarInset>
      <SocialHeader title="Programım" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {DAYS.map((d) => {
          const selected = d === date;
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={formatLong(d)}
              style={{ width: 48, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: selected ? accent : c.surfaceAlt }}
            >
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
      <Text variant="caption" tone="secondary" style={{ marginTop: 8 }}>
        {formatLong(date)}
      </Text>
      {error ? <Notice kind="danger" text={error} /> : null}

      {/* ── Uzmanından ── */}
      {hasExpert ? (
        <>
          <SectionHeader title="Uzmanından" />
          {slots.map((s) => (
            <Card key={s.slot} padded={false} style={{ paddingHorizontal: 16 }}>
              <Text variant="micro" tone="muted" style={{ marginTop: 12 }}>
                {s.slot.toLocaleUpperCase('tr')}
              </Text>
              {s.meals.map((m, i) => (
                <ListRow
                  key={`${m.planId}-${m.id}`}
                  icon="restaurant-outline"
                  title={m.time ? `${m.time} · ${m.name}` : m.name}
                  subtitle={
                    m.chosen.length
                      ? m.options.filter((o) => m.chosen.includes(o.id)).map((o) => o.name).join(', ')
                      : m.options.length > 1
                        ? `${m.options.length} seçenekten ${m.pick} tanesini seç`
                        : (m.options[0]?.name ?? undefined)
                  }
                  onPress={() => router.push(`/my-plan/${m.planId}`)}
                  last={i === s.meals.length - 1}
                />
              ))}
            </Card>
          ))}
          {trainerPrograms.length ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {trainerPrograms.map((p, i) => (
                <ListRow
                  key={p.programId}
                  icon="barbell-outline"
                  title={p.title ?? 'Antrenman programı'}
                  subtitle={`${p.professional.title ? `${p.professional.title} ` : ''}${p.professional.name}`}
                  onPress={() => router.push(`/my-program/${p.programId}`)}
                  last={i === trainerPrograms.length - 1}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {/* ── Görevlerim ── */}
      <SectionHeader title="Görevlerim" action="Kütüphane" onAction={() => router.push('/library')} />
      {future && hasTasks ? <Notice kind="info" text="Gelecek günün görevlerini o gün geldiğinde işaretleyebilirsin." /> : null}

      {/* Kişisel 28 günlük program (kaynağı: SocialFit) */}
      {day?.personalPlan ? (
        <Card onPress={() => router.push(`/plan-day/${day.personalPlan!.source.instanceId}/${day.personalPlan!.dayNumber}`)}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <Tag label={SOURCE_TAG} kind="accent" />
            <Tag label={`${day.personalPlan.weekNumber}. hafta · ${day.personalPlan.dayNumber}. gün`} />
          </View>
          <Text variant="heading">{day.personalPlan.title}</Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
            {day.personalPlan.kind === 'TRAINING' ? `~${day.personalPlan.estimatedMinutes} dk · ${day.personalPlan.progress.doneMain}/${day.personalPlan.progress.plannedMain} hareket tamam` : 'Toparlanma günü · isteğe bağlı hafif hareket'}
          </Text>
          {day.personalPlan.entries.map((e) => (
            <Text key={e.index} variant="body" tone={e.status === 'DONE' ? 'muted' : 'primary'} style={{ marginBottom: 2, textDecorationLine: e.status === 'DONE' ? 'line-through' : 'none' }}>
              {e.status === 'DONE' ? '✓ ' : e.status === 'SKIPPED' ? '– ' : '○ '}
              {e.title} · {e.workText}
            </Text>
          ))}
        </Card>
      ) : null}
      {day?.programs.map((p) => (
        <Card key={p.enrollmentId}>
          <Pressable onPress={() => router.push(`/library-program/${p.program.id}`)}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              <Tag label="Ücretsiz program" kind="success" />
            </View>
            <Text variant="heading">{p.program.title}</Text>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
              {p.dayIndex + 1}. gün / {p.program.totalDays} · ~{durationText(p.durationSec)} · {p.doneCount}/{p.steps.length} tamam
            </Text>
          </Pressable>
          {p.steps.map((s, i) => (
            <View key={s.index}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Check done={s.done} disabled={future} onPress={() => toggleStep(p.enrollmentId, p.dayIndex, s.index, !s.done)} label={s.item.title} />
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/library-item/${s.item.id}`)}>
                  <Text variant="bodyStrong" style={s.done ? { textDecorationLine: 'line-through', color: c.textMuted } : undefined}>
                    {i + 1}. {s.item.title}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {s.workText} · ~{durationText(s.durationSec)}
                  </Text>
                </Pressable>
              </View>
              {i < p.steps.length - 1 && s.restAfterSec ? (
                <Text variant="micro" tone="muted" style={{ marginLeft: 38 }}>
                  {s.restAfterSec} sn dinlen
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ))}

      {day?.tasks.length ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label="Eklediğin hareketler" />
          </View>
          {day.tasks.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Check done={t.done} disabled={future} onPress={() => toggleTask(t.id, !t.done)} label={t.item.title} />
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/library-item/${t.item.id}`)}>
                <Text variant="bodyStrong" style={t.done ? { textDecorationLine: 'line-through', color: c.textMuted } : undefined}>
                  {t.item.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {t.workText} · ~{durationText(t.durationSec)}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeTask(t.id)} accessibilityRole="button" accessibilityLabel={`${t.item.title} görevini kaldır`} hitSlop={8}>
                <Icon name="close" size={20} color={c.textMuted} />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {day && !hasTasks ? (
        <>
          <EmptyState icon="checkbox-outline" title="Bu gün için görev yok" text="Kütüphaneden ücretsiz bir programa katıl ya da tek bir hareketi görevlerine ekle." />
          <Button label="Kütüphaneye git" variant="secondary" onPress={() => router.push('/library')} />
        </>
      ) : null}
    </Screen>
  );
}
