// Egzersiz sayfası. Video alanı boşken gizlenmez; video eklenince (kodla eşleşir) yerine gelir.
import { Card, MediaPlaceholder, Notice, Screen, ScreenHeader, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { CATEGORY_LABELS, findExercise, LEVEL_LABELS } from '@/demo/content';

export default function ExerciseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = findExercise(String(id));

  if (!exercise) {
    return (
      <Screen>
        <ScreenHeader title="Egzersiz bulunamadı" onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={exercise.name} subtitle={`${CATEGORY_LABELS[exercise.category]} · ${exercise.duration}`} onBack={() => router.back()} />

      <MediaPlaceholder icon="videocam-outline" label="Video yakında eklenecek" height={190} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Tag label={LEVEL_LABELS[exercise.level]} kind="accent" />
        <Tag label={exercise.equipment} kind="neutral" icon="construct-outline" />
        <Tag label={exercise.duration} kind="neutral" icon="time-outline" />
      </View>

      <SectionHeader title="Çalışan kaslar" />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {exercise.primary.map((m) => (
            <Tag key={m} label={m} kind="accent" />
          ))}
          {exercise.secondary.map((m) => (
            <Tag key={m} label={m} kind="neutral" />
          ))}
        </View>
        <Text variant="micro" tone="muted" style={{ marginTop: 10 }}>
          Koyu etiketler ana kasları, açık etiketler yardımcı kasları gösterir. Kas haritası çizimi yakında eklenecek.
        </Text>
      </Card>

      <SectionHeader title="Nasıl yapılır" />
      <Card>
        {exercise.steps.map((step, i) => (
          <View key={step} style={{ flexDirection: 'row', gap: 12, marginBottom: i === exercise.steps.length - 1 ? 0 : 12 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#0000', alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="bodyStrong" tone="accent">
                {i + 1}.
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Sık yapılan hatalar" />
      <Card variant="soft">
        {exercise.mistakes.map((m) => (
          <Text key={m} variant="body" style={{ marginBottom: 4 }}>
            • {m}
          </Text>
        ))}
      </Card>

      {exercise.warnings.map((w) => (
        <Notice key={w} kind="warning" text={w} />
      ))}
    </Screen>
  );
}
