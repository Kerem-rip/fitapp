// Bugün: kişisel ana sayfa. Hedefe göre şekillenir; kalori halkası, su, kilo, plan ve programlar.
// Kalori, su, kilo ve beslenme planı sunucudaki gerçek kayıtlardan gelir. Örnek uzmanlar ve ipuçları sadece demo kutusunda görünür.
import type { MeasurementItem, MyPlanListItem } from '@fitapp/api-client';
import { Avatar, Button, Card, IconButton, ListRow, Notice, ProgressBar, ProgressRing, Screen, SectionHeader, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import { AppHeader } from '@/components/AppHeader';
import { DemoBlock } from '@/components/DemoBlock';
import { toggleLike, toggleSave } from '@/demo/actions';
import { PLATFORM_PROGRAMS, TIP_POSTS } from '@/demo/content';
import { formatLong } from '@/demo/dates';
import { useAccount, useDemoState, useShared, useToday, useUserData } from '@/demo/hooks';
import { GOAL_LABELS } from '@/demo/labels';
import { proById } from '@/demo/selectors';
import { SEED_PROS } from '@/demo/seed';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { useTarget } from '@/features/nutrition/useTarget';

const WATER_GOAL_ML = 2000;

// Sunucudaki son iki geçerli kilo ölçümü (en yeni önce)
function useRealWeight() {
  const [weights, setWeights] = useState<MeasurementItem[] | null>(null);
  const [plans, setPlans] = useState<MyPlanListItem[]>([]);
  useFocusEffect(
    useCallback(() => {
      api
        .myMeasurements({ kind: 'WEIGHT' })
        .then((list) => setWeights(list.filter((m) => !m.voided).sort((a, b) => b.takenAt.localeCompare(a.takenAt))))
        .catch(() => setWeights([]));
      api
        .myPlans()
        .then(setPlans)
        .catch(() => setPlans([]));
    }, []),
  );
  return { weights, plans };
}

export function UserHome() {
  const router = useRouter();
  const { c } = useTheme();
  const account = useAccount();
  const data = useUserData();
  const shared = useShared();
  const state = useDemoState();
  const today = useToday();
  const { target, result, missing } = useTarget();
  const { weights, plans } = useRealWeight();
  const { day, run } = useFoodLog(today);

  const teen = account?.roleKey === 'teen';
  const totals = day.totals;
  const water = day.waterMl ?? 0;
  const latest = weights?.[0];
  const weightDelta = latest && weights?.[1] ? Math.round((latest.value - weights[1].value) * 10) / 10 : null;
  const plan = plans[0];

  const followed = SEED_PROS.filter((p) => data.following.includes(p.id));

  // Kayıtlı programlar; yoksa cevaplarına göre öneri (uygulamanın kendi program içerikleri)
  const enrolledPrograms = shared.programs.filter((p) => data.enrollments[p.id]);
  const suggested = useMemo(() => {
    const goals = state.ui.onboarding?.goals ?? [];
    const ids = goals.includes('posture') ? ['masa-basi-durus'] : goals.includes('face') ? ['yuz-masaji-rutini'] : ['ev-baslangic'];
    return PLATFORM_PROGRAMS.filter((p) => ids.includes(p.id) || p.id === 'ev-baslangic').slice(0, 2);
  }, [state.ui.onboarding]);

  if (!account) return null;
  const firstName = account.firstName;

  return (
    <Screen tabBarInset>
      <AppHeader title={`Merhaba, ${firstName}`} subtitle={`${formatLong(today)} · ${teen ? 'genç modu' : GOAL_LABELS[data.goal].toLowerCase()}`} />

      {teen ? (
        <Card variant="accent">
          <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
            GENÇ MODU
          </Text>
          <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
            Bugün de hareketli kal
          </Text>
          <Text variant="body" tone="onAccent" style={{ marginTop: 6, opacity: 0.95 }}>
            Kalori sayımı ve kilo hedefi bu modda kapalı. Egzersizlerine ve su alışkanlığına odaklan.
          </Text>
        </Card>
      ) : missing ? (
        <Card variant="accent">
          <Text variant="caption" tone="onAccent" style={{ opacity: 0.9 }}>
            Bugünkü kalori (tahmini)
          </Text>
          <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
            {totals.kcal} kcal
          </Text>
          <Text variant="body" tone="onAccent" style={{ marginTop: 4, opacity: 0.95 }}>
            Günlük hedefini görmek için boy ve kilonu ekle ya da Beslenme › Hesapla bölümünden kendi hedefini belirle.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button label="Boy ve kilo ekle" variant="light" size="sm" icon="add" onPress={() => router.push('/my-health')} />
            <Button label="Öğün ekle" variant="light" size="sm" onPress={() => router.push('/nutrition')} />
          </View>
        </Card>
      ) : (
        <Card variant="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ProgressRing value={totals.kcal} goal={target} size={124} stroke={13} light>
              <Text variant="title" tone="onAccent">
                {Math.max(0, target - totals.kcal)}
              </Text>
              <Text variant="micro" tone="onAccent">
                kcal kaldı
              </Text>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="onAccent" style={{ opacity: 0.9 }}>
                Bugünkü kalori (tahmini)
              </Text>
              <Text variant="heading" tone="onAccent">
                {totals.kcal} / {target} kcal
              </Text>
              <Text variant="caption" tone="onAccent" style={{ marginTop: 4, opacity: 0.9 }}>
                Protein {totals.proteinG}/{result?.macros.proteinG ?? 0} g
              </Text>
              <Button label="Öğün ekle" variant="light" size="sm" icon="add" onPress={() => router.push('/nutrition')} style={{ marginTop: 10 }} />
            </View>
          </View>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1.15, marginBottom: 0 }}>
          <Text variant="caption" tone="secondary">
            Su
          </Text>
          <Text variant="title">{(water / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L</Text>
          <View style={{ marginVertical: 8 }}>
            <ProgressBar value={water} max={WATER_GOAL_ML} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button label="+250 ml" size="sm" variant="secondary" onPress={() => run(() => api.addWater(250))} />
            <IconButton icon="remove" label="250 ml azalt" size={38} onPress={() => (water > 0 ? run(() => api.addWater(-250)) : undefined)} />
          </View>
        </Card>
        {/* Kilo: sağlık bilgilerimdeki son ölçüm; ölçüm eklemek ve geçmiş için oraya gider */}
        <Card onPress={() => router.push('/my-health')} style={{ flex: 1, marginBottom: 0 }}>
          <Text variant="caption" tone="secondary">
            Kilo
          </Text>
          {latest ? (
            <>
              <Text variant="title">{latest.value.toLocaleString('tr-TR')} kg</Text>
              {weightDelta !== null ? (
                <Tag
                  label={weightDelta === 0 ? 'Değişmedi' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toLocaleString('tr-TR')} kg`}
                  kind={weightDelta <= 0 ? 'success' : 'neutral'}
                  icon={weightDelta <= 0 ? 'trending-down' : 'trending-up'}
                />
              ) : null}
              <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
                {new Date(latest.takenAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · güncellemek için dokun
              </Text>
            </>
          ) : (
            <>
              <Text variant="title">—</Text>
              <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
                {weights === null ? 'Yükleniyor' : 'Kilonu eklemek için dokun'}
              </Text>
            </>
          )}
        </Card>
      </View>

      {plan ? (
        <Card onPress={() => router.push(`/my-plan/${plan.planId}`)} variant="soft">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={plan.professional.name} size={42} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Beslenme planın · sürüm {plan.number}</Text>
              <Text variant="caption" tone="secondary">
                {plan.professional.name} · {plan.mealCount} öğün. Açmak için dokun.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <SectionHeader title={enrolledPrograms.length ? 'Programların' : 'Sana önerilen programlar'} action="Tümü" onAction={() => router.push('/library')} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {(enrolledPrograms.length ? enrolledPrograms : suggested).map((program, i, list) => {
          const done = data.enrollments[program.id]?.completedDays.length ?? 0;
          return (
            <ListRow
              key={program.id}
              icon="barbell-outline"
              title={program.title}
              subtitle={data.enrollments[program.id] ? `Gün ${Math.min(done + 1, program.days.length)}/${program.days.length}` : `${program.weeks} hafta · haftada ${program.daysPerWeek} gün`}
              trailing={data.enrollments[program.id] ? <Tag label="Devam ediyor" kind="accent" /> : undefined}
              onPress={() => router.push(`/program/${program.id}`)}
              last={i === list.length - 1}
            />
          );
        })}
      </Card>

      {!teen ? <Notice kind="info" text="Değerler tahminidir. Kesin plan için bir diyetisyenle çalış." /> : null}

      <DemoBlock>
        {/* Takip edilen örnek uzmanlar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingBottom: 14 }} style={{ marginHorizontal: -16 }}>
          {followed.map((pro) => (
            <Pressable key={pro.id} onPress={() => router.push(`/professional/${pro.id}`)} style={{ alignItems: 'center', width: 70 }}>
              <Avatar name={pro.name} size={56} story />
              <Text variant="micro" tone="secondary" numberOfLines={1} style={{ marginTop: 6 }}>
                {pro.name.replace('Dyt. ', '').split(' ')[0]}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/discover')} style={{ alignItems: 'center', width: 70 }}>
            <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              <IconButton icon="add" label="Uzman bul" size={40} />
            </View>
            <Text variant="micro" tone="secondary" style={{ marginTop: 6 }}>
              Uzman bul
            </Text>
          </Pressable>
        </ScrollView>

        <SectionHeader title="Uzmanlardan ipuçları" />
        {TIP_POSTS.map((post) => {
          const pro = proById(post.proId);
          if (!pro) return null;
          const liked = data.likes.includes(post.id);
          const saved = data.saves.includes(post.id);
          return (
            <Card key={post.id}>
              <Pressable onPress={() => router.push(`/professional/${pro.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar name={pro.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{pro.name}</Text>
                  <Text variant="caption" tone="muted">
                    {post.tag} · {post.minutesAgo < 60 ? `${post.minutesAgo} dk` : `${Math.round(post.minutesAgo / 60)} sa`}
                  </Text>
                </View>
                <Tag label="Örnek" kind="neutral" />
              </Pressable>
              <Text variant="body">{post.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
                <Pressable onPress={() => toggleLike(account.id, post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={8}>
                  <IconButton icon={liked ? 'heart' : 'heart-outline'} label="Beğen" size={36} onPress={() => toggleLike(account.id, post.id)} />
                  <Text variant="caption" tone={liked ? 'danger' : 'secondary'} style={{ fontWeight: '700' }}>
                    {post.likes + (liked ? 1 : 0)}
                  </Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label="Kaydet" size={36} onPress={() => toggleSave(account.id, post.id)} />
              </View>
            </Card>
          );
        })}
        {!teen ? <ListRow icon="search-outline" title="Diyetisyen veya eğitmen bul" subtitle="Örnek uzman listesi" onPress={() => router.push('/discover')} last /> : null}
      </DemoBlock>
    </Screen>
  );
}
