// Danışan sayfası (diyetisyen ve eğitmen). Danışan sadece paylaşmaya izin verdiği verileri gösterir.
// Boy, kilo, alerji gibi bilgiler burada güncellenir; değişince diyet önerisi taslağı yenilenir.
import { ALLERGEN_LABELS_TR, ALLERGENS, type ActivityLevel, type Allergen, type DietPreference, type Goal } from '@fitapp/shared';
import {
  BarChart,
  BottomSheet,
  Button,
  Card,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  showToast,
  Tag,
  Text,
  TextField,
} from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppointmentSheet } from '@/components/AppointmentSheet';
import { ChipRow } from '@/components/ChipRow';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { assignProgram, endClientLink, startConversation, updateClient } from '@/demo/actions';
import { formatShort } from '@/demo/dates';
import { useAccount, useDemoState } from '@/demo/hooks';
import { ACTIVITY_LABELS, DIET_LABELS, GOAL_LABELS } from '@/demo/labels';
import { activeLinksOf, clientView, fullName } from '@/demo/selectors';

const num = (text: string) => Number(text.replace(',', '.'));

export default function ClientScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const state = useDemoState();

  const link = useMemo(
    () => (account ? activeLinksOf(state, account.id).find((l) => l.clientId === id) : undefined),
    [state, account, id],
  );
  const view = link ? clientView(state, link.clientId) : undefined;

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState<Goal>('maintain');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [diet, setDiet] = useState<DietPreference>('none');
  const [allergens, setAllergens] = useState<Allergen[] | null>(null);
  const [aptOpen, setAptOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // Kayıtlı değerler değişince (ör. danışan kendi kilosunu güncelleyince) form yenilenir
  const stamp = view
    ? `${view.heightCm}|${view.weightKg}|${view.targetWeightKg}|${view.goal}|${view.activity}|${view.diet}|${JSON.stringify(view.allergens)}`
    : '';
  useEffect(() => {
    if (!view) return;
    setHeight(String(view.heightCm));
    setWeight(String(view.weightKg));
    setTarget(String(view.targetWeightKg));
    setGoal(view.goal);
    setActivity(view.activity);
    setDiet(view.diet);
    setAllergens(view.allergens);
  }, [stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return null;
  if (!view || !link) {
    return (
      <Screen>
        <ScreenHeader title="Danışan" onBack={() => router.back()} />
        <Notice kind="info" text="Bu danışanın verilerine erişimin yok. Danışan bağlantısı sonlanmış olabilir." />
      </Screen>
    );
  }

  const isDietitian = account.roleKey === 'dietitian';
  const plan = state.shared.plans.find((p) => p.clientId === view.id && p.proId === account.id);
  const assigned = state.shared.assignments.find((a) => a.clientId === view.id && a.trainerId === account.id);
  const assignedProgram = assigned ? state.shared.programs.find((p) => p.id === assigned.programId) : undefined;
  const myPrograms = state.shared.programs.filter((p) => p.status === 'published');
  const clientNames = activeLinksOf(state, account.id).flatMap((l) => clientView(state, l.clientId)?.name ?? []);
  const weightSeries = view.weights.slice(-6);

  const toggleAllergen = (a: Allergen) =>
    setAllergens((cur) => {
      const list = cur ?? [];
      return list.includes(a) ? list.filter((x) => x !== a) : [...list, a];
    });

  const save = () => {
    const h = num(height);
    const w = num(weight);
    const t = num(target);
    if (!(h >= 120 && h <= 230) || !(w >= 30 && w <= 300) || !(t >= 30 && t <= 300)) {
      showToast('Boy, kilo ve hedef kilo değerlerini kontrol et', 'warning');
      return;
    }
    updateClient(view.id, {
      heightCm: h,
      weightKg: w,
      targetWeightKg: t,
      goal,
      activity,
      diet,
      ...(isDietitian ? { allergens } : {}),
    });
    showToast('Danışan bilgileri güncellendi');
  };

  const message = () => {
    const partyId = view.accountId ?? view.id;
    const conversationId = startConversation({ id: account.id, name: fullName(account) }, { id: partyId, name: view.name });
    router.push(`/chat/${conversationId}`);
  };

  return (
    <Screen>
      <ScreenHeader title={view.name} subtitle={`${view.ageYears} yaş · ${GOAL_LABELS[view.goal]}`} onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {view.accountLinked ? <Tag label="Uygulama hesabı bağlı" kind="success" icon="link-outline" /> : <Tag label="Kayıtlı danışan" kind="neutral" />}
        {isDietitian && view.allergens === null ? <Tag label="Alerji bilgisi eksik" kind="danger" icon="warning-outline" /> : null}
        {view.lastEntryDaysAgo >= 5 ? <Tag label={`${view.lastEntryDaysAgo} gündür kayıt yok`} kind="warning" /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button label="Mesaj" icon="chatbubble-ellipses-outline" variant="secondary" block onPress={message} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Randevu" icon="calendar-outline" variant="secondary" block onPress={() => setAptOpen(true)} />
        </View>
      </View>

      <SectionHeader title="Ölçüler ve bilgiler" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Hedef (kg)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
          </View>
        </View>
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Hedef
        </Text>
        <ChipRow wrap options={(Object.keys(GOAL_LABELS) as Goal[]).map((key) => ({ key, label: GOAL_LABELS[key] }))} selected={[goal]} onToggle={setGoal} />
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Hareket düzeyi
        </Text>
        <ChipRow wrap options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => ({ key, label: ACTIVITY_LABELS[key] }))} selected={[activity]} onToggle={setActivity} />
        {isDietitian ? (
          <>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
              Beslenme tercihi
            </Text>
            <ChipRow wrap options={(Object.keys(DIET_LABELS) as DietPreference[]).map((key) => ({ key, label: DIET_LABELS[key] }))} selected={[diet]} onToggle={setDiet} />
            <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
              Alerjiler {allergens === null ? '(bilgi yok)' : ''}
            </Text>
            <ChipRow
              wrap
              options={[
                { key: 'none' as const, label: 'Alerji yok' },
                ...ALLERGENS.map((key) => ({ key: key as Allergen | 'none', label: ALLERGEN_LABELS_TR[key] })),
              ]}
              selected={allergens === null ? [] : allergens.length === 0 ? ['none'] : allergens}
              onToggle={(key) => (key === 'none' ? setAllergens([]) : toggleAllergen(key as Allergen))}
            />
          </>
        ) : null}
        <Button label="Kaydet" block onPress={save} />
      </Card>

      <SectionHeader title="Kilo takibi" />
      {view.sharing.weight ? (
        <Card>
          <BarChart
            values={weightSeries.map((w) => w.kg)}
            labels={weightSeries.map((w) => formatShort(w.date))}
            format={(v) => `${v.toLocaleString('tr-TR')} kg`}
          />
          <Text variant="caption" tone="secondary" style={{ marginTop: 8 }}>
            Hedef: {view.targetWeightKg.toLocaleString('tr-TR')} kg
          </Text>
        </Card>
      ) : (
        <Notice kind="info" text="Danışan kilo verisini paylaşmıyor." />
      )}

      <SectionHeader title="Bugünkü öğünler" />
      {view.sharing.meals ? (
        view.mealsToday.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {view.mealsToday.map((m, i) => (
              <ListRow key={`${m.name}-${i}`} icon="restaurant-outline" title={m.name} trailing={<Text variant="bodyStrong">{m.kcal} kcal</Text>} last={i === view.mealsToday.length - 1} />
            ))}
          </Card>
        ) : (
          <Text variant="caption" tone="muted">
            Bugün henüz öğün kaydı yok.
          </Text>
        )
      ) : (
        <Notice kind="info" text="Danışan öğün kayıtlarını paylaşmıyor." />
      )}

      {isDietitian ? (
        <>
          <SectionHeader title="Beslenme planı" />
          {plan ? (
            <Card variant="soft">
              <Text variant="bodyStrong">Aktif plan · {plan.targetKcal} kcal</Text>
              <Text variant="caption" tone="secondary">
                {formatShort(plan.createdAt.slice(0, 10))} tarihinde gönderildi
              </Text>
            </Card>
          ) : null}
          <Button label={plan ? 'Planı yenile' : 'Diyet önerisi hazırla'} size="lg" block icon="sparkles-outline" onPress={() => router.push(`/suggestion/${view.id}`)} />
        </>
      ) : (
        <>
          <SectionHeader title="Antrenman programı" />
          {assignedProgram ? (
            <Card variant="soft" onPress={() => router.push(`/program/${assignedProgram.id}`)}>
              <Text variant="bodyStrong">{assignedProgram.title}</Text>
              <Text variant="caption" tone="secondary">
                {assignedProgram.weeks} hafta · haftada {assignedProgram.daysPerWeek} gün
              </Text>
            </Card>
          ) : null}
          <Button label={assignedProgram ? 'Programı değiştir' : 'Program ata'} size="lg" block icon="barbell-outline" onPress={() => setAssignOpen(true)} />
        </>
      )}

      <Button label="Danışanlığı sonlandır" variant="danger" block onPress={() => setEndOpen(true)} style={{ marginTop: 16 }} />
      <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
        Sonlandırınca danışanın verilerine erişimin hemen kapanır.
      </Text>

      <AppointmentSheet visible={aptOpen} onClose={() => setAptOpen(false)} ownerId={account.id} clientNames={clientNames} defaultClient={view.name} titleLabel={isDietitian ? 'Randevu' : 'Ders'} />

      <BottomSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Program seç">
        {myPrograms.map((p, i) => (
          <ListRow
            key={p.id}
            icon="albums-outline"
            title={p.title}
            subtitle={`${p.weeks} hafta · haftada ${p.daysPerWeek} gün`}
            onPress={() => {
              assignProgram(p.id, view.id, account.id);
              setAssignOpen(false);
              showToast(`${p.title} atandı`);
            }}
            last={i === myPrograms.length - 1}
          />
        ))}
      </BottomSheet>

      <ConfirmSheet
        visible={endOpen}
        title="Danışanlığı sonlandır"
        text={`${view.name} ile danışan bağlantısı sona erer ve verilerine erişimin hemen kapanır.`}
        confirmLabel="Sonlandır"
        danger
        onConfirm={() => {
          endClientLink(link.id);
          showToast('Danışan bağlantısı sonlandırıldı', 'info');
          router.back();
        }}
        onClose={() => setEndOpen(false)}
      />
    </Screen>
  );
}
