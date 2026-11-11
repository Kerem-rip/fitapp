// Beslenme planlarım (danışan): diyetisyenimin onaylayıp yayınladığı planlar.
import type { MyPlanListItem } from '@fitapp/api-client';
import { Card, EmptyState, Notice, Screen, ScreenHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatDay } from '@/features/sharing/labels';

export default function MyPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<MyPlanListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .myPlans()
        .then((list) => {
          setPlans(list);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  return (
    <Screen>
      <ScreenHeader title="Beslenme planım" subtitle="Diyetisyenimin onayladığı planlar" onBack={() => router.back()} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {plans && plans.length === 0 ? (
        <EmptyState icon="restaurant-outline" title="Henüz planın yok" text="Diyetisyenin bir plan onaylayıp yayınladığında burada görünür." />
      ) : null}
      {plans?.map((p) => (
        <Card key={p.planId} onPress={() => router.push(`/my-plan/${p.planId}`)} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label={`Sürüm ${p.number}`} kind="success" />
          </View>
          <Text variant="heading">{p.title ?? 'Beslenme planı'}</Text>
          <Text variant="caption" tone="secondary">
            {p.professional.title ? `${p.professional.title} ` : ''}
            {p.professional.name} · {p.mealCount} öğün{p.approvedAt ? ` · ${formatDay(p.approvedAt)}` : ''}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
