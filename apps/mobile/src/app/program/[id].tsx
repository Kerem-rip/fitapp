// Program sayfası: gün gün egzersizler. Kullanıcı programa başlar ve günleri işaretler;
// eğitmen programı danışanına atar.
import { Button, Card, ListRow, Notice, ProgressBar, BottomSheet, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, IconButton } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { assignProgram, enroll, leaveProgram, submitProgram, toggleProgramDay } from '@/demo/actions';
import { findExercise, LEVEL_LABELS } from '@/demo/content';
import { useAccount, useDemoState, useShared, useUserData } from '@/demo/hooks';
import { activeLinksOf, clientView } from '@/demo/selectors';

export default function ProgramScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const shared = useShared();
  const state = useDemoState();
  const data = useUserData();
  const [assignOpen, setAssignOpen] = useState(false);

  const program = shared.programs.find((p) => p.id === id);
  const isTrainer = account?.roleKey === 'trainer';
  const isOwner = Boolean(program && program.authorId && program.authorId === account?.id);
  const enrollment = program ? data.enrollments[program.id] : undefined;
  const clients = useMemo(
    () => (account && isTrainer ? activeLinksOf(state, account.id).flatMap((l) => clientView(state, l.clientId) ?? []) : []),
    [state, account, isTrainer],
  );

  if (!program || !account) {
    return (
      <Screen>
        <ScreenHeader title="Program bulunamadı" onBack={() => router.back()} />
      </Screen>
    );
  }

  const done = enrollment?.completedDays.length ?? 0;
  const nextDay = enrollment ? program.days.findIndex((_, i) => !enrollment.completedDays.includes(i + 1)) + 1 : 0;
  const statusTag =
    program.status === 'published' ? <Tag label="Yayında" kind="success" /> : program.status === 'pending' ? <Tag label="Onay bekliyor" kind="warning" /> : <Tag label="Taslak" kind="neutral" />;

  return (
    <Screen>
      <ScreenHeader title={program.title} subtitle={`${program.authorName} · ${LEVEL_LABELS[program.level]}`} onBack={() => router.back()} />

      <Card>
        <Text variant="body">{program.description}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Tag label={`${program.weeks} hafta`} kind="accent" icon="calendar-outline" />
          <Tag label={`Haftada ${program.daysPerWeek} gün`} kind="neutral" />
          <Tag label={`${program.days.length} gün`} kind="neutral" />
          {isOwner ? statusTag : null}
        </View>
      </Card>

      {isTrainer ? (
        <View style={{ gap: 10, marginBottom: 12 }}>
          {program.status === 'published' ? <Button label="Danışanına ata" size="lg" block icon="person-add-outline" onPress={() => setAssignOpen(true)} /> : null}
          {isOwner && program.status === 'draft' ? (
            <>
              <Notice kind="info" text="Herkese açık yayın için admin onayı gerekir. Onaya gönderince program 'Onay bekliyor' durumuna geçer; sen yine de danışanlarına atayamazsın." />
              <Button label="Yayın için onaya gönder" size="lg" block onPress={() => { submitProgram(program.id); showToast('Program onaya gönderildi'); }} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ marginBottom: 12 }}>
          {enrollment ? (
            <>
              <Card>
                <Text variant="caption" tone="secondary">
                  İlerleme
                </Text>
                <Text variant="heading" style={{ marginBottom: 8 }}>
                  {done} / {program.days.length} gün
                </Text>
                <ProgressBar value={done} max={program.days.length} />
                {nextDay > 0 && nextDay <= program.days.length ? (
                  <Text variant="caption" tone="accent" style={{ marginTop: 8, fontWeight: '700' }}>
                    Sıradaki: Gün {nextDay}
                  </Text>
                ) : (
                  <Text variant="caption" tone="success" style={{ marginTop: 8, fontWeight: '700' }}>
                    Programı tamamladın, tebrikler!
                  </Text>
                )}
              </Card>
              <Button label="Programdan ayrıl" variant="ghost" block onPress={() => { leaveProgram(account.id, program.id); showToast('Programdan ayrıldın', 'info'); }} />
            </>
          ) : (
            <Button label="Programa başla" size="lg" block icon="play" onPress={() => { enroll(account.id, program.id); showToast('Program başladı, kolay gelsin!'); }} />
          )}
        </View>
      )}

      <SectionHeader title="Günler" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {program.days.slice(0, 30).map((day, i) => {
          const completed = enrollment?.completedDays.includes(i + 1) ?? false;
          return (
            <ListRow
              key={day.title}
              icon={completed ? 'checkmark-circle' : 'ellipse-outline'}
              title={day.title}
              subtitle={day.exerciseIds.map((e) => findExercise(e)?.name ?? e).join(' · ')}
              trailing={
                enrollment ? (
                  <IconButton
                    icon={completed ? 'checkmark' : 'add'}
                    label={completed ? 'Günü geri al' : 'Günü tamamla'}
                    size={36}
                    filled={completed}
                    onPress={() => toggleProgramDay(account.id, program.id, i + 1)}
                  />
                ) : undefined
              }
              onPress={() => router.push(`/exercise/${day.exerciseIds[0]}`)}
              last={i === Math.min(program.days.length, 30) - 1}
            />
          );
        })}
      </Card>
      {program.days.length > 30 ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
          İlk 30 gün gösteriliyor.
        </Text>
      ) : null}

      <BottomSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Hangi danışana atansın?">
        {clients.map((client, i) => (
          <ListRow
            key={client.id}
            avatar={client.name}
            title={client.name}
            subtitle={shared.assignments.find((a) => a.clientId === client.id && a.trainerId === account.id)?.programId === program.id ? 'Bu program zaten atanmış' : undefined}
            onPress={() => {
              assignProgram(program.id, client.id, account.id);
              setAssignOpen(false);
              showToast(`${program.title}, ${client.name} danışanına atandı`);
            }}
            last={i === clients.length - 1}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
