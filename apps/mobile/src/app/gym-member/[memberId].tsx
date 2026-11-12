// Salon üyesi ayrıntısı: üyelikler, ödeme kayıtları ve kalan tutar.
// Ödemeler sadece kayıttır (nakit/kart/havale masada alınır). Kayıt silinmez; yanlışsa sahip gerekçeyle iptal eder.
import type { GymMemberDetail, GymMemberLessons, GymPaymentItem, MembershipItem, MembershipPlanItem, PaymentMethod } from '@fitapp/api-client';
import { BottomSheet, Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { parseDateInput } from '@/features/health/labels';
import { formatDate, formatTL, membershipTag, METHOD_LABELS, parseDayInput, parseTL } from '@/features/gym/labels';
import { useGymInfo } from '@/features/gym/useGymInfo';

const LESSON_STATUS = {
  BOOKED: { label: 'Yazılı', kind: 'info' },
  ATTENDED: { label: 'Katıldı', kind: 'success' },
  NO_SHOW: { label: 'Gelmedi', kind: 'warning' },
  CANCELLED: { label: 'Kaldırıldı', kind: 'neutral' },
} as const;

type ReasonTarget = { kind: 'membership'; item: MembershipItem } | { kind: 'payment'; item: GymPaymentItem };

export default function GymMemberScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { can } = useGymInfo();
  const [detail, setDetail] = useState<GymMemberDetail | null>(null);
  const [lessons, setLessons] = useState<GymMemberLessons | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [reasonFor, setReasonFor] = useState<ReasonTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, l] = await Promise.all([api.gymMember(memberId), api.gymMemberLessons(memberId)]);
      setDetail(d);
      setLessons(l);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(gym-manager)/members'));

  if (!detail) {
    return (
      <Screen>
        <ScreenHeader title="Üye" onBack={back} />
        {error ? <Notice kind="danger" text={error} /> : null}
      </Screen>
    );
  }

  const { member, memberships, payments, balance } = detail;
  const archived = member.status === 'ARCHIVED';
  const current = memberships.find((m) => m.status === 'ACTIVE' && (m.state === 'ACTIVE' || m.state === 'UPCOMING')) ?? null;

  const setArchived = async (next: boolean) => {
    try {
      await api.updateGymMember(member.id, { status: next ? 'ARCHIVED' : 'ACTIVE' });
      showToast(next ? 'Üye arşivlendi' : 'Üye arşivden çıkarıldı');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title={member.fullName} subtitle={archived ? 'Arşivde' : 'Salon üyesi'} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {member.phone !== undefined || member.note ? (
        <Card style={{ marginBottom: 12 }}>
          {member.phone ? <Text variant="body">Telefon: {member.phone}</Text> : null}
          {member.note ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {member.note}
            </Text>
          ) : null}
          <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
            Kayıt: {formatDate(member.createdAt)}
          </Text>
        </Card>
      ) : null}

      {balance ? (
        <Card variant={balance.balanceKurus > 0 ? 'accent' : undefined} style={{ marginBottom: 12 }}>
          <Text variant="micro" tone={balance.balanceKurus > 0 ? 'onAccent' : 'secondary'}>
            KALAN ÖDEME
          </Text>
          <Text variant="title" tone={balance.balanceKurus > 0 ? 'onAccent' : undefined} style={{ marginTop: 4 }}>
            {balance.balanceKurus > 0 ? formatTL(balance.balanceKurus) : 'Borcu yok'}
          </Text>
          <Text variant="caption" tone={balance.balanceKurus > 0 ? 'onAccent' : 'secondary'}>
            Üyelikler {formatTL(balance.chargedKurus)} · ödenen {formatTL(balance.paidKurus)}
          </Text>
        </Card>
      ) : null}

      {!archived && (can('memberships.manage') || can('payments.record')) ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          {can('memberships.manage') ? <Button label="Üyelik sat" icon="add" style={{ flex: 1 }} onPress={() => setSelling(true)} /> : null}
          {can('payments.record') ? <Button label="Ödeme kaydet" icon="cash-outline" variant="secondary" style={{ flex: 1 }} onPress={() => setPaying(true)} /> : null}
        </View>
      ) : null}

      <SectionHeader title="Üyelikler" />
      {memberships.length === 0 ? <Notice kind="info" text="Henüz üyelik yok." /> : null}
      {memberships.map((m) => {
        const tag = membershipTag(m);
        return (
          <Card key={m.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading">{m.planName}</Text>
              <Tag label={tag.label} kind={tag.kind} />
            </View>
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {formatDate(m.startDate)} – {formatDate(m.endDate)}
              {m.sessionsTotal !== null ? ` · ${m.sessionsLeft}/${m.sessionsTotal} ders kaldı` : ''}
            </Text>
            {m.dueKurus !== undefined ? (
              <Text variant="caption" tone="secondary">
                Ücret {formatTL(m.priceKurus)}
                {m.dueKurus > 0 ? ` · kalan ${formatTL(m.dueKurus)}` : ' · ödendi'}
              </Text>
            ) : null}
            {m.cancelReason ? (
              <Text variant="caption" tone="muted">
                İptal gerekçesi: {m.cancelReason}
              </Text>
            ) : null}
            {m.status === 'ACTIVE' && can('memberships.manage') && m.state !== 'EXPIRED' ? (
              <Button label="Üyeliği iptal et" size="sm" variant="ghost" onPress={() => setReasonFor({ kind: 'membership', item: m })} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
            ) : null}
          </Card>
        );
      })}

      {lessons && lessons.upcoming.length + lessons.history.length > 0 ? (
        <>
          <SectionHeader title="Dersler" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {[...lessons.upcoming, ...lessons.history.slice(0, 10)].map((b, i, list) => (
              <ListRow
                key={b.bookingId}
                icon={b.lesson.kind === 'GROUP' ? 'people-outline' : 'barbell-outline'}
                title={`${formatDate(b.lesson.date)} · ${b.lesson.startTime} · ${b.lesson.title}`}
                subtitle={b.status === 'ATTENDED' ? (b.deducted ? 'Katıldı · 1 ders hakkı düştü' : 'Katıldı') : b.lesson.trainer.name}
                trailing={<Tag label={LESSON_STATUS[b.status].label} kind={LESSON_STATUS[b.status].kind} />}
                onPress={() => router.push(`/gym-lesson/${b.lesson.id}`)}
                last={i === list.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {payments ? (
        <>
          <SectionHeader title="Ödeme kayıtları" />
          {payments.length === 0 ? <Notice kind="info" text="Henüz ödeme kaydı yok." /> : null}
          {payments.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {payments.map((p, i) => (
                <ListRow
                  key={p.id}
                  icon={p.voidedAt ? 'close-circle-outline' : 'cash-outline'}
                  title={`${formatTL(p.amountKurus)} · ${METHOD_LABELS[p.method]}`}
                  subtitle={[formatDate(p.paidAt), p.note, p.voidedAt ? `İptal: ${p.voidReason}` : null].filter(Boolean).join(' · ')}
                  trailing={
                    p.voidedAt ? (
                      <Tag label="İptal edildi" kind="neutral" />
                    ) : can('payments.void') ? (
                      <Button label="İptal et" size="sm" variant="ghost" onPress={() => setReasonFor({ kind: 'payment', item: p })} />
                    ) : undefined
                  }
                  last={i === payments.length - 1}
                />
              ))}
            </Card>
          ) : null}
          <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
            Ödemeler sadece kayıttır; para uygulama üzerinden alınmaz. Kayıtlar silinmez, yanlış kayıt gerekçeyle iptal edilir.
          </Text>
        </>
      ) : null}

      {can('members.manage') ? (
        <Button
          label={archived ? 'Arşivden çıkar' : 'Üyeyi arşivle'}
          variant="ghost"
          block
          onPress={() => setArchived(!archived)}
          style={{ marginTop: 16 }}
        />
      ) : null}

      {selling ? (
        <SellSheet
          onClose={() => setSelling(false)}
          onSubmit={async (input) => {
            await api.sellMembership(member.id, input);
            showToast('Üyelik eklendi');
            await load();
          }}
        />
      ) : null}
      {paying ? (
        <PaymentSheet
          onClose={() => setPaying(false)}
          suggestedKurus={balance && balance.balanceKurus > 0 ? balance.balanceKurus : undefined}
          current={current}
          onSubmit={async (input) => {
            await api.recordGymPayment(member.id, input);
            showToast('Ödeme kaydedildi');
            await load();
          }}
        />
      ) : null}
      {reasonFor ? (
        <ReasonSheet
          target={reasonFor}
          onClose={() => setReasonFor(null)}
          onSubmit={async (reason) => {
            if (reasonFor.kind === 'membership') await api.cancelMembership(reasonFor.item.id, reason);
            else await api.voidGymPayment(reasonFor.item.id, reason);
            showToast(reasonFor.kind === 'membership' ? 'Üyelik iptal edildi' : 'Ödeme kaydı iptal edildi');
            await load();
          }}
        />
      ) : null}
    </Screen>
  );
}

function SellSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { planId: string; startDate?: string; priceKurus?: number }) => Promise<void>;
}) {
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .gymPlans()
      .then((list) => {
        setPlans(list);
        const first = list[0];
        setPlanId(first?.id ?? null);
        setPrice(first ? String(first.priceKurus / 100).replace('.', ',') : '');
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  const pick = (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setPrice(String(plan.priceKurus / 100).replace('.', ','));
  };

  const submit = async () => {
    if (busy || !planId) return;
    const plan = plans.find((p) => p.id === planId);
    const startDate = parseDayInput(start);
    if (startDate === null) return setError('Başlangıcı GG.AA.YYYY biçiminde yaz ya da boş bırak (bugün).');
    const kurus = price.trim() === '0' ? 0 : parseTL(price);
    if (kurus === null) return setError('Ücreti TL olarak yaz (ör. 1.500 ya da 1500,50).');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ planId, startDate, priceKurus: kurus !== plan?.priceKurus ? kurus : undefined });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const plan = plans.find((p) => p.id === planId);
  return (
    <BottomSheet visible onClose={onClose} title="Üyelik sat">
      {error ? <Notice kind="warning" text={error} /> : null}
      {plans.length === 0 ? <Notice kind="info" text="Önce Salon sekmesinden bir üyelik paketi tanımlanmalı." /> : null}
      <ChipRow wrap options={plans.map((p) => ({ key: p.id, label: p.name }))} selected={planId ? [planId] : []} onToggle={pick} />
      {plan ? (
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          {plan.durationDays} gün{plan.sessionCount ? ` · ${plan.sessionCount} ders` : ''} · liste fiyatı {formatTL(plan.priceKurus)}
        </Text>
      ) : null}
      <TextField label="Başlangıç (isteğe bağlı)" value={start} onChangeText={setStart} placeholder="GG.AA.YYYY · boşsa bugün" keyboardType="numbers-and-punctuation" />
      <TextField label="Ücret (TL)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" hint="İndirim yaptıysan burada değiştir. Paket fiyatı değişse de bu üyelik bu ücretle kalır." />
      <Button label={busy ? 'Kaydediliyor...' : 'Üyeliği ekle'} size="lg" block disabled={busy || !planId} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

function PaymentSheet({
  onClose,
  onSubmit,
  suggestedKurus,
  current,
}: {
  onClose: () => void;
  onSubmit: (input: { amountKurus: number; method: PaymentMethod; paidAt?: string; membershipId?: string; note?: string }) => Promise<void>;
  suggestedKurus?: number;
  current: MembershipItem | null;
}) {
  const [amount, setAmount] = useState(suggestedKurus ? String(suggestedKurus / 100).replace('.', ',') : '');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [linkCurrent, setLinkCurrent] = useState(true);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const kurus = parseTL(amount);
    if (kurus === null) return setError('Tutarı TL olarak yaz (ör. 1.500 ya da 1500,50).');
    const paidAt = parseDateInput(date);
    if (paidAt === null) return setError('Tarihi GG.AA.YYYY biçiminde yaz (bugünden ilerisi olamaz) ya da boş bırak.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ amountKurus: kurus, method, paidAt, membershipId: current && linkCurrent ? current.id : undefined, note: note.trim() || undefined });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Ödeme kaydet">
      {error ? <Notice kind="warning" text={error} /> : null}
      <Notice kind="info" text="Bu sadece kayıttır: parayı masada aldıktan sonra buraya yaz. Uygulama para çekmez." />
      <TextField label="Tutar (TL)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Nasıl ödendi?
      </Text>
      <ChipRow wrap options={METHODS.map((m) => ({ key: m, label: METHOD_LABELS[m] }))} selected={[method]} onToggle={setMethod} />
      {current ? (
        <ChipRow
          wrap
          options={[
            { key: 'yes', label: `${current.planName} için` },
            { key: 'no', label: 'Üyeliğe bağlama' },
          ]}
          selected={[linkCurrent ? 'yes' : 'no']}
          onToggle={(k) => setLinkCurrent(k === 'yes')}
        />
      ) : null}
      <TextField label="Ödeme tarihi (isteğe bağlı)" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY · boşsa şimdi" keyboardType="numbers-and-punctuation" />
      <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={200} />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}

function ReasonSheet({ target, onClose, onSubmit }: { target: ReasonTarget; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (reason.trim().length < 3) return setError('Gerekçeyi yaz.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const isPayment = target.kind === 'payment';
  return (
    <BottomSheet visible onClose={onClose} title={isPayment ? 'Ödeme kaydını iptal et' : 'Üyeliği iptal et'}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <Text variant="body" style={{ marginBottom: 8 }}>
        {isPayment
          ? 'Kayıt silinmez; iptal edildi olarak görünür ve toplamlara katılmaz.'
          : 'Üyelik iptal edildi olarak kalır; ücreti kalan ödemeye artık eklenmez.'}
      </Text>
      <TextField label="Gerekçe" value={reason} onChangeText={setReason} maxLength={300} />
      <Button label={busy ? 'Kaydediliyor...' : 'İptal et'} size="lg" variant="danger" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
