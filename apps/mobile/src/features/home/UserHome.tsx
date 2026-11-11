// Bugün: kişisel ana sayfa. Hedefe göre şekillenir; kalori halkası, su, kilo, program ve uzman ipuçları.
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  IconButton,
  ListRow,
  Notice,
  ProgressBar,
  ProgressRing,
  Screen,
  SectionHeader,
  showToast,
  Tag,
  Text,
  TextField,
  useTheme,
} from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { addWater, addWeight, toggleLike, toggleSave } from '@/demo/actions';
import { PLATFORM_PROGRAMS, TIP_POSTS } from '@/demo/content';
import { formatLong } from '@/demo/dates';
import { useAccount, useDemoState, useEnsureConsent, useShared, useToday, useUserData } from '@/demo/hooks';
import { GOAL_LABELS } from '@/demo/labels';
import { proById, totalsOf } from '@/demo/selectors';
import { SEED_PROS } from '@/demo/seed';
import { useTarget } from '@/features/nutrition/useTarget';

const WATER_GOAL_ML = 2000;

export function UserHome() {
  const router = useRouter();
  const { c } = useTheme();
  const account = useAccount();
  const data = useUserData();
  const shared = useShared();
  const state = useDemoState();
  const today = useToday();
  const { target, result } = useTarget();
  const ensureConsent = useEnsureConsent();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightText, setWeightText] = useState('');

  const teen = account?.roleKey === 'teen';
  const entries = data.meals[today];
  const totals = useMemo(() => totalsOf(entries ?? []), [entries]);
  const water = data.waterMl[today] ?? 0;
  const previousWeight = data.weights.length > 1 ? data.weights[data.weights.length - 2]!.kg : data.weightKg;
  const weightDelta = Math.round((data.weightKg - previousWeight) * 10) / 10;

  const followed = SEED_PROS.filter((p) => data.following.includes(p.id));
  const plan = shared.plans.find((p) => shared.clients[p.clientId]?.accountId === account?.id);

  // Kayıtlı programlar; yoksa cevaplarına göre öneri
  const enrolledPrograms = shared.programs.filter((p) => data.enrollments[p.id]);
  const suggested = useMemo(() => {
    const goals = state.ui.onboarding?.goals ?? [];
    const ids = goals.includes('posture') ? ['masa-basi-durus'] : goals.includes('face') ? ['yuz-masaji-rutini'] : ['ev-baslangic'];
    return PLATFORM_PROGRAMS.filter((p) => ids.includes(p.id) || p.id === 'ev-baslangic').slice(0, 2);
  }, [state.ui.onboarding]);

  const saveWeight = () => {
    const kg = Number(weightText.replace(',', '.'));
    if (!account || !ensureConsent()) return;
    if (!(kg >= 30 && kg <= 300)) {
      showToast('Kiloyu 30-300 kg arasında gir', 'warning');
      return;
    }
    addWeight(account.id, kg);
    setWeightOpen(false);
    showToast('Kilon kaydedildi');
  };

  if (!account) return null;
  const firstName = account.firstName;

  return (
    <Screen tabBarInset>
      <AppHeader title={`Merhaba, ${firstName}`} subtitle={`${formatLong(today)} · ${teen ? 'genç modu' : GOAL_LABELS[data.goal].toLowerCase()}`} />

      {/* Hikâye halkaları: takip ettiğin uzmanlar */}
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
            <Button label="+250 ml" size="sm" variant="secondary" onPress={() => addWater(account.id, today, 250)} />
            <IconButton icon="remove" label="250 ml azalt" size={38} onPress={() => addWater(account.id, today, -250)} />
          </View>
        </Card>
        <Card onPress={() => { setWeightText(String(data.weightKg)); setWeightOpen(true); }} style={{ flex: 1, marginBottom: 0 }}>
          <Text variant="caption" tone="secondary">
            Kilo
          </Text>
          <Text variant="title">{data.weightKg.toLocaleString('tr-TR')} kg</Text>
          <Tag label={weightDelta === 0 ? 'Değişmedi' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toLocaleString('tr-TR')} kg`} kind={weightDelta <= 0 ? 'success' : 'neutral'} icon={weightDelta <= 0 ? 'trending-down' : 'trending-up'} />
          <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
            Güncellemek için dokun
          </Text>
        </Card>
      </View>

      {plan ? (
        <Card onPress={() => router.push('/nutrition')} variant="soft">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name="Dyt. Zeynep Arslan" size={42} story />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Diyetisyeninden yeni plan</Text>
              <Text variant="caption" tone="secondary">
                {plan.targetKcal} kcal hedefli plan hazır. Beslenme sekmesinden bak.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <SectionHeader title={enrolledPrograms.length ? 'Programların' : 'Sana önerilen programlar'} action="Tümü" onAction={() => router.push('/exercises')} />
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
              <Tag label="Doğrulanmış" kind="success" icon="checkmark-circle" />
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

      {!teen ? <Notice kind="info" text="Değerler tahminidir. Kesin plan için bir diyetisyenle çalış." /> : null}
      {!teen ? <ListRow icon="search-outline" title="Diyetisyen veya eğitmen bul" subtitle="Doğrulanmış uzmanlara uygulama içinden ulaş" onPress={() => router.push('/discover')} last /> : null}

      <BottomSheet visible={weightOpen} onClose={() => setWeightOpen(false)} title="Kilonu güncelle">
        <TextField label="Kilo (kg)" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" />
        <Button label="Kaydet" size="lg" block onPress={saveWeight} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </Screen>
  );
}
