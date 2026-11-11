// Egzersiz kütüphanesi: fitness, evde, duruş ve yüz masajı. Videolar sonradan eklenecek.
import { Card, ListRow, Notice, ProgressBar, Screen, ScreenHeader, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { CATEGORY_LABELS, EXERCISES, LEVEL_LABELS } from '@/demo/content';
import { useShared, useUserData } from '@/demo/hooks';
import type { ExerciseCategory } from '@/demo/types';

const CATEGORIES = (Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((key) => ({ key, label: CATEGORY_LABELS[key] }));

export function ExercisesScreen() {
  const router = useRouter();
  const data = useUserData();
  const shared = useShared();
  const [category, setCategory] = useState<ExerciseCategory>('home');

  const programs = shared.programs.filter((p) => p.status === 'published' && p.category === category);
  const exercises = EXERCISES.filter((e) => e.category === category);
  const mine = shared.programs.filter((p) => data.enrollments[p.id]);

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Egzersiz" subtitle="Programlar ve hareketler" />

      {mine.length > 0 ? (
        <>
          <SectionHeader title="Devam eden programların" />
          {mine.map((program) => {
            const done = data.enrollments[program.id]?.completedDays.length ?? 0;
            return (
              <Card key={program.id} onPress={() => router.push(`/program/${program.id}`)}>
                <Text variant="heading">{program.title}</Text>
                <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
                  {done} / {program.days.length} gün tamamlandı
                </Text>
                <ProgressBar value={done} max={program.days.length} />
              </Card>
            );
          })}
        </>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <ChipRow options={CATEGORIES} selected={[category]} onToggle={setCategory} />
      </View>

      {category === 'posture' ? (
        <>
          <Notice kind="info" title="Duruş bölümü" text="Uygulama duruş analizi yapmaz ve teşhis koymaz. Bu hareketler, kendinde duruş sorunu olduğunu düşünenlerin başlangıç egzersizleridir. Ağrın varsa önce doktora başvur." />
          <Card variant="soft">
            <Text variant="bodyStrong">Kendi kendine kontrol</Text>
            <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
              Sırtını, kalçanı ve topuklarını duvara yasla. Başın kendiliğinden duvara değmiyorsa duruş programlarına göz at.
            </Text>
          </Card>
        </>
      ) : null}
      {category === 'face' ? (
        <Notice kind="info" title="Yüz masajı" text="Bu rutinler rahatlamayı ve kan dolaşımını desteklemeyi amaçlar. Cildin hassassa veya yüzünde yara varsa uygulama." />
      ) : null}

      <SectionHeader title="Programlar" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {programs.map((p, i) => (
          <ListRow
            key={p.id}
            icon="albums-outline"
            title={p.title}
            subtitle={`${p.weeks} hafta · haftada ${p.daysPerWeek} gün · ${LEVEL_LABELS[p.level]}`}
            trailing={data.enrollments[p.id] ? <Tag label="Devam ediyor" kind="accent" /> : undefined}
            onPress={() => router.push(`/program/${p.id}`)}
            last={i === programs.length - 1}
          />
        ))}
        {programs.length === 0 ? (
          <Text variant="caption" tone="muted" style={{ paddingVertical: 14 }}>
            Bu kategoride henüz program yok.
          </Text>
        ) : null}
      </Card>

      <SectionHeader title="Egzersizler" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {exercises.map((e, i) => (
          <ListRow
            key={e.id}
            icon="fitness-outline"
            title={e.name}
            subtitle={`${e.primary.join(', ')} · ${e.equipment}`}
            trailing={<Tag label={LEVEL_LABELS[e.level]} kind="neutral" />}
            onPress={() => router.push(`/exercise/${e.id}`)}
            last={i === exercises.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );
}
