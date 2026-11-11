// Randevularım ve hedeflerim (danışan). Uzmanın hazırlık notu ve görüşme özeti burada görünmez.
import type { MyAppointment, MyGoal } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatWhen, MODE_LABELS, STATUS_TAGS } from '@/features/agenda/helpers';
import { KIND_LABELS } from '@/features/health/labels';

const num = (v: number | null) => (v === null ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<MyAppointment[] | null>(null);
  const [goals, setGoals] = useState<MyGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MyAppointment | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, g] = await Promise.all([api.myAppointments(), api.myGoals()]);
      setAppointments(a);
      setGoals(g);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelMyAppointment(cancelTarget.id, reason.trim() || undefined);
      setCancelTarget(null);
      setReason('');
      showToast('Randevu iptal edildi; uzmanına bildirildi', 'info');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const now = Date.now();
  const upcoming = (appointments ?? []).filter((a) => a.status === 'SCHEDULED' && new Date(a.startsAt).getTime() >= now);
  const past = (appointments ?? []).filter((a) => !upcoming.includes(a)).reverse();

  return (
    <Screen>
      <ScreenHeader title="Randevularım" subtitle="ve hedeflerim" onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}

      <SectionHeader title="Yaklaşan randevular" />
      {appointments && upcoming.length === 0 ? <EmptyState icon="calendar-outline" title="Yaklaşan randevun yok" /> : null}
      {upcoming.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
            <Tag label={MODE_LABELS[a.mode]} kind="accent" />
          </View>
          <Text variant="heading">{formatWhen(a.startsAt)}</Text>
          <Text variant="caption" tone="secondary">
            {a.professional.title ? `${a.professional.title} ` : ''}
            {a.professional.name} · {a.durationMin} dk{a.title ? ` · ${a.title}` : ''}
            {a.location ? ` · ${a.location}` : ''}
          </Text>
          <Button label="İptal et" variant="ghost" size="sm" onPress={() => setCancelTarget(a)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </Card>
      ))}

      <SectionHeader title="Hedeflerim" />
      {goals.length === 0 ? (
        <Text variant="caption" tone="muted">
          Uzmanınla belirlenmiş aktif hedef yok.
        </Text>
      ) : null}
      {goals.map((g) => (
        <Card key={g.id} style={{ marginBottom: 10 }}>
          <Text variant="bodyStrong">{g.title}</Text>
          <Text variant="caption" tone="secondary">
            {g.measurementKind ? `${KIND_LABELS[g.measurementKind]}: ${num(g.startValue)} → ${num(g.targetValue)} ${g.unit ?? ''} · ` : ''}
            {g.professional}
            {g.targetDate ? ` · ${new Date(g.targetDate).toLocaleDateString('tr-TR')}` : ''}
          </Text>
        </Card>
      ))}

      {past.length > 0 ? (
        <>
          <SectionHeader title="Geçmiş" />
          {past.slice(0, 10).map((a) => (
            <Card key={a.id} variant="outline" style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                <Tag label={STATUS_TAGS[a.status].label} kind={STATUS_TAGS[a.status].kind} />
              </View>
              <Text variant="caption" tone="secondary">
                {formatWhen(a.startsAt)} · {a.professional.name}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      <BottomSheet visible={cancelTarget !== null} onClose={() => setCancelTarget(null)} title="Randevuyu iptal et">
        <Text variant="body" tone="secondary" style={{ marginBottom: 10 }}>
          {cancelTarget ? formatWhen(cancelTarget.startsAt) : ''} randevusu iptal edilecek ve uzmanına bildirilecek.
        </Text>
        <TextField label="Neden (isteğe bağlı)" value={reason} onChangeText={setReason} maxLength={300} />
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Button label="İptal et" variant="danger" size="lg" block onPress={cancel} />
          <Button label="Vazgeç" variant="ghost" block onPress={() => setCancelTarget(null)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
