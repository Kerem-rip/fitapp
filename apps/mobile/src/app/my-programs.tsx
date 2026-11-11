// Antrenman programlarım (danışan): antrenörümün onaylayıp yayınladığı programlar.
import type { MyProgramListItem } from '@fitapp/api-client';
import { Card, EmptyState, Notice, Screen, ScreenHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatDay } from '@/features/sharing/labels';

export default function MyProgramsScreen() {
  const router = useRouter();
  const [programs, setPrograms] = useState<MyProgramListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .myPrograms()
        .then((list) => {
          setPrograms(list);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  return (
    <Screen>
      <ScreenHeader title="Antrenman programım" subtitle="Antrenörümün onayladığı programlar" onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {programs && programs.length === 0 ? (
        <EmptyState icon="barbell-outline" title="Henüz programın yok" text="Antrenörün bir program onaylayıp yayınladığında burada görünür." />
      ) : null}
      {programs?.map((p) => (
        <Card key={p.programId} onPress={() => router.push(`/my-program/${p.programId}`)} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label={`Sürüm ${p.number}`} kind="success" />
          </View>
          <Text variant="heading">{p.title ?? 'Antrenman programı'}</Text>
          <Text variant="caption" tone="secondary">
            {p.professional.name} · {p.dayCount} gün{p.approvedAt ? ` · ${formatDay(p.approvedAt)}` : ''}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
