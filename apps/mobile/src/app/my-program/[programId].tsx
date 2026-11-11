// Programım (danışan): günler ve egzersizler; bir günü tamamlayınca setleri, eforu ve varsa ağrıyı kaydederim.
import type { MyProgramView, ProgramDay, WorkoutLogItem } from '@fitapp/api-client';
import { Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { WorkoutLogSheet } from '@/features/programs/WorkoutLogSheet';

export default function MyProgramScreen() {
  const router = useRouter();
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const [program, setProgram] = useState<MyProgramView | null>(null);
  const [logs, setLogs] = useState<WorkoutLogItem[]>([]);
  const [logDay, setLogDay] = useState<ProgramDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([api.myProgram(programId), api.myWorkouts()]);
      setProgram(p);
      setLogs(l.filter((x) => x.programId === programId));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [programId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const lastDone = (dayId: string | undefined) => logs.find((l) => l.dayId === dayId)?.date;

  return (
    <Screen>
      <ScreenHeader title={program?.title ?? 'Programım'} subtitle={program ? `${program.professional.name} · sürüm ${program.version.number}` : undefined} onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {program?.goal ? <Notice kind="info" title="Hedef" text={program.goal} /> : null}
      {program?.notes ? <Text variant="body" tone="secondary" style={{ marginBottom: 8 }}>{program.notes}</Text> : null}

      {program?.days.map((d) => (
        <Card key={d.id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">
              {d.name}
              {d.focus ? ` · ${d.focus}` : ''}
            </Text>
            {lastDone(d.id) ? <Tag label={`Son: ${lastDone(d.id)}`} kind="success" /> : null}
          </View>
          {d.exercises.map((e, i) => (
            <View key={e.id} style={{ marginTop: 8 }}>
              <Text variant="bodyStrong">
                {i + 1}. {e.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {e.sets} × {e.reps}
                {e.load ? ` · ${e.load}` : ''}
                {e.restSec !== undefined ? ` · ${e.restSec} sn dinlenme` : ''}
              </Text>
              {e.notes ? <Text variant="caption" tone="muted">{e.notes}</Text> : null}
            </View>
          ))}
          <Button label="Bu günü kaydet" icon="checkmark-circle-outline" size="sm" onPress={() => setLogDay(d)} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
        </Card>
      ))}

      {logs.length > 0 ? (
        <>
          <SectionHeader title="Son kayıtlarım" />
          {logs.slice(0, 5).map((l) => (
            <Text key={l.id} variant="caption" tone="secondary" style={{ marginBottom: 4 }}>
              {l.date} · {program?.days.find((d) => d.id === l.dayId)?.name ?? 'Antrenman'}
              {l.rpe ? ` · efor ${l.rpe}/10` : ''}
              {l.pain ? ' · ağrı bildirildi' : ''}
            </Text>
          ))}
        </>
      ) : null}

      <Text variant="micro" tone="muted" style={{ marginTop: 12 }}>
        Egzersiz sırasında keskin ağrı, baş dönmesi ya da nefes darlığı hissedersen dur ve antrenörüne bildir. Kayıtların, "Antrenman kayıtlarım"ı paylaşıyorsan antrenörüne görünür.
      </Text>

      <WorkoutLogSheet
        day={logDay}
        onClose={() => setLogDay(null)}
        onSubmit={async (input) => {
          await api.logProgramDay(programId, input);
          showToast(input.pain ? 'Kaydedildi; ağrı bildirimin antrenörüne iletildi' : 'Antrenman kaydedildi');
          await load();
        }}
      />
    </Screen>
  );
}
