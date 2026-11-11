// Danışan dosyasının "Antrenmanlar" sekmesi (antrenör): antrenman kayıtları, egzersiz başına performans
// ve yüz yüze seansı danışan adına kaydetme. Sadece danışan "Antrenman kayıtlarım"ı paylaşıyorsa görünür.
import type { ExercisePerformance, ProgramDay, WorkoutLogItem } from '@fitapp/api-client';
import { BarChart, Button, Card, EmptyState, Notice, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { SOURCE_LABELS } from '@/features/health/labels';
import { WorkoutLogSheet } from './WorkoutLogSheet';

const setsText = (sets: { reps: number; loadKg?: number }[]) => sets.map((s) => (s.loadKg !== undefined ? `${s.reps}×${s.loadKg.toLocaleString('tr-TR')} kg` : `${s.reps}`)).join(', ');

export function WorkoutsTab({ clientId, visible }: { clientId: string; visible: boolean }) {
  const [logs, setLogs] = useState<WorkoutLogItem[]>([]);
  const [perf, setPerf] = useState<ExercisePerformance[]>([]);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [logDay, setLogDay] = useState<ProgramDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!visible) return;
    try {
      const [l, p, program] = await Promise.all([api.clientWorkouts(clientId), api.clientPerformance(clientId), api.clientProgram(clientId)]);
      setLogs(l);
      setPerf(p);
      setDays(program.published?.content.days ?? []);
      setSelected((cur) => cur ?? p[0]?.key ?? null);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId, visible]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!visible) return <EmptyState icon="lock-closed-outline" title="Antrenman kayıtları paylaşılmıyor" text="Danışan paylaşımı açarsa kayıtları ve performans burada görünür." />;

  const current = perf.find((p) => p.key === selected);
  const loads = current?.sessions.filter((s) => s.bestLoadKg !== null) ?? [];

  return (
    <>
      {error ? <Notice kind="danger" text={error} /> : null}

      {days.length > 0 ? (
        <>
          <SectionHeader title="Yüz yüze seansı kaydet" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {days.map((d) => (
              <Button key={d.id} label={d.name} size="sm" variant="secondary" icon="add" onPress={() => setLogDay(d)} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Performans" />
      {perf.length === 0 ? (
        <Text variant="caption" tone="muted">
          Henüz kayıt yok.
        </Text>
      ) : (
        <>
          <ChipRow options={perf.map((p) => ({ key: p.key, label: p.name }))} selected={selected ? [selected] : []} onToggle={setSelected} />
          {current ? (
            <Card>
              {loads.length >= 2 ? (
                <BarChart values={loads.map((s) => s.bestLoadKg!)} labels={loads.map((s) => s.date.slice(5))} format={(v) => `${v.toLocaleString('tr-TR')} kg`} />
              ) : null}
              {current.sessions
                .slice()
                .reverse()
                .map((s) => (
                  <Text key={s.date} variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                    {s.date} · en yüksek {s.bestLoadKg !== null ? `${s.bestLoadKg.toLocaleString('tr-TR')} kg` : '—'} · {s.totalReps} tekrar · hacim{' '}
                    {s.volumeKg.toLocaleString('tr-TR')} kg
                  </Text>
                ))}
              <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
                Değerler danışanın girdiği kayıtların özetidir; yorum içermez.
              </Text>
            </Card>
          ) : null}
        </>
      )}

      <SectionHeader title="Antrenman kayıtları" />
      {logs.map((l) => (
        <Card key={l.id} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <Tag label={l.date} kind="neutral" />
            {l.rpe ? <Tag label={`Efor ${l.rpe}/10`} kind="neutral" /> : null}
            {l.pain ? <Tag label="Ağrı bildirildi" kind="danger" /> : null}
            <Tag label={SOURCE_LABELS[l.source]} kind="neutral" />
          </View>
          {l.entries.map((e, i) => (
            <Text key={i} variant="caption" tone="secondary">
              • {e.name}: {setsText(e.sets)}
            </Text>
          ))}
          {l.pain && l.painNote ? <Text variant="caption" tone="danger">Ağrı: {l.painNote}</Text> : null}
          {l.note ? <Text variant="caption" tone="muted">Not: {l.note}</Text> : null}
        </Card>
      ))}

      <WorkoutLogSheet
        day={logDay}
        title="Seansı danışan adına kaydet"
        onClose={() => setLogDay(null)}
        onSubmit={async (input) => {
          await api.addClientWorkout(clientId, input);
          showToast('Seans kaydedildi');
          await load();
        }}
      />
    </>
  );
}
