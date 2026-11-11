// Danışan dosyasının "Takip" sekmesi: hedefler (ilerlemeyle), randevular ve danışana hatırlatmalar.
// Hedef değerleri uzmanındır; sistem "uygun hedef" önermez.
import type { AppointmentMode, GoalItem, MeasurementKind, ProAppointment, ReminderItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Notice, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { KIND_LABELS } from '@/features/health/labels';
import { formatWhen, MODE_LABELS, parseDateTime, STATUS_TAGS, todayText } from './helpers';

type Sheet = 'goal' | 'appointment' | 'reminder' | { outcome: ProAppointment } | null;

const GOAL_KINDS: (MeasurementKind | 'NONE')[] = ['NONE', 'WEIGHT', 'WAIST', 'HIP', 'BODY_FAT_PERCENT'];
const DURATIONS = ['30', '45', '60'] as const;
const num = (v: number | null) => (v === null ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));

export function FollowTab({ clientId, onChanged }: { clientId: string; onChanged: () => void }) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [appointments, setAppointments] = useState<ProAppointment[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form alanları (sayfalar arasında paylaşılır)
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<MeasurementKind | 'NONE'>('WEIGHT');
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('45');
  const [mode, setMode] = useState<AppointmentMode>('ONLINE');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const from = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const to = new Date(Date.now() + 120 * 86_400_000).toISOString();
      const [g, a, r] = await Promise.all([api.clientGoals(clientId), api.clientAppointments(clientId, from, to), api.clientReminders(clientId)]);
      setGoals(g);
      setAppointments(a);
      setReminders(r);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = (next: NonNullable<Sheet>) => {
    setSheet(next);
    setSheetError(null);
    setTitle('');
    setValue('');
    setNotes('');
    setDate(next === 'reminder' || next === 'appointment' ? todayText(1) : '');
    setTime(next === 'reminder' ? '09:00' : '10:00');
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      showToast(done, 'info');
      await load();
      onChanged();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const submit = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    setSheetError(null);
    try {
      if (sheet === 'goal') {
        const target = value.trim() ? Number(value.replace(',', '.')) : undefined;
        const targetDate = date.trim() ? parseDateTime(date, '12:00') : undefined;
        if (targetDate === null) throw new Error('Hedef tarihini GG.AA.YYYY biçiminde yaz ya da boş bırak.');
        await api.addGoal(clientId, {
          title: title.trim(),
          ...(kind !== 'NONE' ? { measurementKind: kind, targetValue: target } : {}),
          ...(targetDate ? { targetDate } : {}),
        });
        showToast('Hedef eklendi');
      } else if (sheet === 'appointment') {
        const startsAt = parseDateTime(date, time);
        if (!startsAt) throw new Error('Tarihi GG.AA.YYYY ve saati SS:DD biçiminde yaz.');
        await api.addAppointment(clientId, { startsAt, durationMin: Number(duration), mode, title: title.trim() || undefined, notes: notes.trim() || undefined });
        showToast('Randevu verildi; danışana bildirim gitti');
      } else if (sheet === 'reminder') {
        const remindAt = parseDateTime(date, time);
        if (!remindAt) throw new Error('Tarihi GG.AA.YYYY ve saati SS:DD biçiminde yaz.');
        await api.addReminder(clientId, { text: title.trim(), remindAt });
        showToast('Hatırlatma kuruldu');
      } else {
        await api.setAppointmentStatus(sheet.outcome.id, { status: 'COMPLETED', outcome: notes.trim() || undefined });
        showToast('Randevu tamamlandı olarak işaretlendi');
      }
      setSheet(null);
      await load();
      onChanged();
    } catch (e) {
      setSheetError(e instanceof Error && !('code' in e) ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const active = goals.filter((g) => g.status === 'ACTIVE');
  const upcoming = appointments.filter((a) => a.status === 'SCHEDULED');
  const past = appointments.filter((a) => a.status !== 'SCHEDULED').reverse();
  const pendingReminders = reminders.filter((r) => !r.sentAt && !r.cancelledAt);

  return (
    <>
      {error ? <Notice kind="danger" text={error} /> : null}

      <SectionHeader title={`Hedefler (${active.length})`} action="Ekle" onAction={() => open('goal')} />
      {active.length === 0 ? (
        <Text variant="caption" tone="muted">
          Aktif hedef yok.
        </Text>
      ) : null}
      {active.map((g) => (
        <Card key={g.id} style={{ marginBottom: 10 }}>
          <Text variant="heading">{g.title}</Text>
          {g.measurementKind ? (
            <Text variant="caption" tone="secondary">
              {KIND_LABELS[g.measurementKind]}: başlangıç {num(g.startValue)} → hedef {num(g.targetValue)} {g.progress?.unit ?? ''}
              {g.targetDate ? ` · ${new Date(g.targetDate).toLocaleDateString('tr-TR')}` : ''}
            </Text>
          ) : null}
          {g.progress ? (
            <Text variant="bodyStrong" style={{ marginTop: 6 }}>
              Son ölçüm: {num(g.progress.latestValue)} {g.progress.unit}
              {g.progress.remaining !== null ? ` · hedefe ${num(Math.abs(g.progress.remaining))} ${g.progress.unit}` : ''}
            </Text>
          ) : g.progressHidden ? (
            <Text variant="caption" tone="muted">
              Danışan bu ölçümü paylaşmadığı için ilerleme görünmüyor.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button label="Ulaşıldı" size="sm" variant="secondary" onPress={() => act(() => api.setGoalStatus(g.id, 'ACHIEVED'), 'Hedef ulaşıldı olarak kapatıldı')} />
            <Button label="Bırak" size="sm" variant="ghost" onPress={() => act(() => api.setGoalStatus(g.id, 'DROPPED'), 'Hedef bırakıldı')} />
          </View>
        </Card>
      ))}

      <SectionHeader title={`Randevular (${upcoming.length} planlı)`} action="Randevu ver" onAction={() => open('appointment')} />
      {upcoming.map((a) => {
        const started = new Date(a.startsAt).getTime() <= Date.now();
        return (
          <Card key={a.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
              <Tag label={STATUS_TAGS[a.status].label} kind={STATUS_TAGS[a.status].kind} />
              <Tag label={MODE_LABELS[a.mode]} kind="neutral" />
            </View>
            <Text variant="bodyStrong">
              {formatWhen(a.startsAt)} · {a.durationMin} dk
            </Text>
            {a.title ? <Text variant="caption" tone="secondary">{a.title}</Text> : null}
            {a.notes ? <Text variant="caption" tone="muted">Not: {a.notes}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {started ? (
                <>
                  <Button label="Tamamlandı" size="sm" onPress={() => { open({ outcome: a }); }} />
                  <Button label="Gelmedi" size="sm" variant="secondary" onPress={() => act(() => api.setAppointmentStatus(a.id, { status: 'NO_SHOW' }), 'Gelmedi olarak işaretlendi')} />
                </>
              ) : null}
              <Button label="İptal et" size="sm" variant="ghost" onPress={() => act(() => api.setAppointmentStatus(a.id, { status: 'CANCELLED' }), 'Randevu iptal edildi; danışana bildirim gitti')} />
            </View>
          </Card>
        );
      })}
      {past.slice(0, 5).map((a) => (
        <Card key={a.id} variant="outline" style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
            <Tag label={STATUS_TAGS[a.status].label} kind={STATUS_TAGS[a.status].kind} />
          </View>
          <Text variant="caption" tone="secondary">
            {formatWhen(a.startsAt)}
            {a.title ? ` · ${a.title}` : ''}
          </Text>
          {a.outcome ? <Text variant="caption">Özet: {a.outcome}</Text> : null}
        </Card>
      ))}

      <SectionHeader title={`Danışana hatırlatmalar (${pendingReminders.length} bekliyor)`} action="Kur" onAction={() => open('reminder')} />
      {reminders.slice(0, 8).map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{r.text}</Text>
              <Text variant="caption" tone="muted">
                {formatWhen(r.remindAt)} · {r.sentAt ? 'gönderildi' : r.cancelledAt ? 'iptal' : 'bekliyor'}
              </Text>
            </View>
            {!r.sentAt && !r.cancelledAt ? (
              <Button label="İptal" size="sm" variant="ghost" onPress={() => act(() => api.cancelReminder(r.id), 'Hatırlatma iptal edildi')} />
            ) : null}
          </View>
        </Card>
      ))}

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'goal' ? 'Yeni hedef' : sheet === 'appointment' ? 'Randevu ver' : sheet === 'reminder' ? 'Hatırlatma kur' : 'Görüşme özeti'}
      >
        {sheetError ? <Notice kind="warning" text={sheetError} /> : null}
        {sheet === 'goal' ? (
          <>
            <TextField label="Hedef" value={title} onChangeText={setTitle} placeholder="ör. 3 ayda bel çevresini azaltmak" maxLength={120} />
            <ChipRow wrap options={GOAL_KINDS.map((k) => ({ key: k, label: k === 'NONE' ? 'Ölçümsüz (alışkanlık)' : KIND_LABELS[k] }))} selected={[kind]} onToggle={setKind} />
            {kind !== 'NONE' ? <TextField label="Hedef değer" value={value} onChangeText={setValue} keyboardType="decimal-pad" hint="Başlangıç değeri danışanın son ölçümünden alınır" /> : null}
            <TextField label="Hedef tarihi (isteğe bağlı)" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY" />
          </>
        ) : null}
        {sheet === 'appointment' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <TextField label="Tarih" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Saat" value={time} onChangeText={setTime} placeholder="SS:DD" />
              </View>
            </View>
            <ChipRow wrap options={DURATIONS.map((d) => ({ key: d, label: `${d} dk` }))} selected={[duration]} onToggle={setDuration} />
            <ChipRow wrap options={(['ONLINE', 'IN_PERSON'] as const).map((m) => ({ key: m, label: MODE_LABELS[m] }))} selected={[mode]} onToggle={setMode} />
            <TextField label="Başlık (isteğe bağlı)" value={title} onChangeText={setTitle} placeholder="ör. Kontrol görüşmesi" maxLength={80} />
            <TextField label="Hazırlık notu (sadece sen görürsün)" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
          </>
        ) : null}
        {sheet === 'reminder' ? (
          <>
            <TextField label="Hatırlatma" value={title} onChangeText={setTitle} placeholder="ör. Bugün kilonu girmeyi unutma" maxLength={300} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <TextField label="Tarih" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Saat" value={time} onChangeText={setTime} placeholder="SS:DD" />
              </View>
            </View>
            <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>
              Zamanı gelince danışana bildirim olarak gider. Bildirim metnine sağlık bilgisi yazma.
            </Text>
          </>
        ) : null}
        {sheet !== null && typeof sheet === 'object' ? (
          <TextField label="Görüşme özeti (sadece sen görürsün)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
        ) : null}
        <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </>
  );
}
