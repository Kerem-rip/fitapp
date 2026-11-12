// Salon dersi ayrıntısı: kayıtlı üyeler, katılım işaretleme, üye yazma ve dersi iptal.
// "Katıldı" uygun üyelikten 1 ders hakkı düşer, "Gelmedi" düşmez; işaret geri alınınca hak geri gelir.
import type { GymBookingItem, GymLessonDetail } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { formatLong } from '@/demo/dates';
import { useToday } from '@/demo/hooks';
import { MemberPicker } from '@/features/gym/MemberPicker';

const STATUS: Record<GymBookingItem['status'], { label: string; kind: 'neutral' | 'success' | 'warning' | 'info' }> = {
  BOOKED: { label: 'Yazılı', kind: 'info' },
  ATTENDED: { label: 'Katıldı', kind: 'success' },
  NO_SHOW: { label: 'Gelmedi', kind: 'warning' },
  CANCELLED: { label: 'Kaldırıldı', kind: 'neutral' },
};

export default function GymLessonScreen() {
  const router = useRouter();
  const today = useToday();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [detail, setDetail] = useState<GymLessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api.gymLesson(lessonId));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [lessonId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!detail) {
    return (
      <Screen>
        <ScreenHeader title="Ders" onBack={back} />
        {error ? <Notice kind="danger" text={error} /> : null}
      </Screen>
    );
  }

  const { lesson, bookings, canManage } = detail;
  const cancelled = lesson.status === 'CANCELLED';
  const past = lesson.date <= today;
  const full = bookings.length >= lesson.capacity;

  const run = async (fn: () => Promise<{ warning?: { text: string } | null } | unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = (await fn()) as { warning?: { text: string } | null } | undefined;
      showToast(res?.warning ? res.warning.text : message, res?.warning ? 'warning' : 'success');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={lesson.title} subtitle={`${formatLong(lesson.date)} · ${lesson.startTime}`} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <Tag label={lesson.kind === 'GROUP' ? 'Grup dersi' : 'Özel ders'} kind={lesson.kind === 'GROUP' ? 'info' : 'accent'} />
          {cancelled ? <Tag label="İptal edildi" kind="neutral" /> : null}
          {lesson.seriesId ? <Tag label="Haftalık" kind="neutral" /> : null}
        </View>
        <Text variant="body">Eğitmen: {lesson.trainer.name}</Text>
        <Text variant="caption" tone="secondary">
          {lesson.durationMin} dk · {lesson.kind === 'GROUP' ? `${bookings.length}/${lesson.capacity} kişi` : 'birebir'}
        </Text>
        {cancelled && lesson.cancelReason ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            İptal gerekçesi: {lesson.cancelReason}
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Katılım" />
      {bookings.length === 0 ? <Notice kind="info" text="Bu derse yazılı üye yok." /> : null}
      {bookings.map((b) => (
        <Card key={b.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodyStrong" onPress={() => router.push(`/gym-member/${b.member.id}`)}>
              {b.member.fullName}
            </Text>
            <Tag label={STATUS[b.status].label} kind={STATUS[b.status].kind} />
          </View>
          {b.status === 'ATTENDED' ? (
            <Text variant="caption" tone="secondary">
              {b.deducted ? '1 ders hakkı düşüldü' : 'Ders hakkı düşülmedi (sınırsız üyelik ya da uygun üyelik yok)'}
            </Text>
          ) : null}
          {b.warning ? (
            <Text variant="caption" style={{ marginTop: 2 }} tone="secondary">
              ⚠ {b.warning.text}
            </Text>
          ) : null}
          {canManage && !cancelled ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {b.status === 'BOOKED' && past ? (
                <>
                  <Button label="Katıldı" size="sm" disabled={busy} onPress={() => run(() => api.markGymBooking(b.id, 'ATTENDED'), 'Katılım kaydedildi')} />
                  <Button label="Gelmedi" size="sm" variant="secondary" disabled={busy} onPress={() => run(() => api.markGymBooking(b.id, 'NO_SHOW'), 'Gelmedi olarak işaretlendi')} />
                </>
              ) : null}
              {b.status === 'ATTENDED' || b.status === 'NO_SHOW' ? (
                <Button
                  label="İşareti geri al"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => run(() => api.markGymBooking(b.id, 'BOOKED'), b.deducted ? 'İşaret geri alındı, ders hakkı geri eklendi' : 'İşaret geri alındı')}
                />
              ) : null}
              {b.status === 'BOOKED' ? (
                <Button label="Dersten çıkar" size="sm" variant="ghost" disabled={busy} onPress={() => run(() => api.unbookGymLesson(b.id), 'Üye dersten çıkarıldı')} />
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}
      {canManage && !cancelled && !past ? (
        <Text variant="caption" tone="muted">
          Katılım ders günü ya da sonrasında işaretlenir.
        </Text>
      ) : null}

      {canManage && !cancelled ? (
        <>
          {!full ? <Button label="Üye yaz" icon="person-add-outline" block onPress={() => setAdding(true)} style={{ marginTop: 12 }} /> : null}
          <Button label="Dersi iptal et" variant="ghost" block onPress={() => setCancelling(true)} style={{ marginTop: 8 }} />
        </>
      ) : null}
      <Text variant="micro" tone="muted" style={{ marginTop: 10 }}>
        Sadece &quot;Katıldı&quot; ders hakkından düşer. Ders hakkı biten ya da üyeliği olmayan üye için uyarı çıkar; karar salonundur.
      </Text>

      {adding ? (
        <BottomSheet visible onClose={() => setAdding(false)} title="Derse üye yaz">
          <MemberPicker
            exclude={bookings.map((b) => b.member.id)}
            onPick={(m) => {
              setAdding(false);
              void run(() => api.bookGymLesson(lesson.id, m.id), `${m.fullName} derse yazıldı`);
            }}
          />
        </BottomSheet>
      ) : null}
      {cancelling ? (
        <CancelSheet
          series={lesson.seriesId !== null}
          onClose={() => setCancelling(false)}
          onSubmit={async (reason, wholeSeries) => {
            const res = await api.cancelGymLesson(lesson.id, reason, wholeSeries);
            showToast(res.cancelled > 1 ? `${res.cancelled} ders iptal edildi` : 'Ders iptal edildi');
            await load();
          }}
        />
      ) : null}
    </Screen>
  );
}

function CancelSheet({ series, onClose, onSubmit }: { series: boolean; onClose: () => void; onSubmit: (reason: string, wholeSeries: boolean) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [whole, setWhole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (reason.trim().length < 3) return setError('Gerekçeyi yaz.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim(), whole);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Dersi iptal et">
      {error ? <Notice kind="warning" text={error} /> : null}
      <Text variant="body" style={{ marginBottom: 8 }}>
        İptal edilen derste kimsenin ders hakkı düşmez. Katılımı işaretlenmiş ders iptal edilemez.
      </Text>
      {series ? (
        <ChipRow
          wrap
          options={[
            { key: 'one', label: 'Sadece bu hafta' },
            { key: 'all', label: 'Bu ve sonraki haftalar' },
          ]}
          selected={[whole ? 'all' : 'one']}
          onToggle={(k) => setWhole(k === 'all')}
        />
      ) : null}
      <TextField label="Gerekçe" value={reason} onChangeText={setReason} maxLength={300} />
      <Button label={busy ? 'Kaydediliyor...' : 'İptal et'} size="lg" variant="danger" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
