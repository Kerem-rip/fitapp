// Bölge ekranı: yalnızca o bölgenin antrenmanları (seviye ve ortama göre) ve hareketleri. Karma antrenman yoktur (Tüm vücut hariç).
import type { WorkoutCardSummary, WorkoutRegion } from '@fitapp/api-client';
import { ListRow, Notice, Screen, ScreenHeader, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { LEVEL_TEXT } from '@/features/library/labels';
import { CardTile, HeroImage } from './CardHero';

export function RegionScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [region, setRegion] = useState<WorkoutRegion | null>(null);
  const [cards, setCards] = useState<WorkoutCardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .workoutCards()
      .then((r) => {
        setRegion(r.regions.find((x) => x.key === key) ?? null);
        setCards(r.cards.filter((x) => x.regionKey === key));
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [key]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));
  const face = region?.category === 'face';

  return (
    <Screen>
      <ScreenHeader title={region?.title ?? 'Bölge'} subtitle={region ? `${region.moveCount} Hareket · ${region.cardCount} antrenman` : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {region ? (
        <>
          <HeroImage hero={region.hero} height={150} />
          {face ? (
            <View style={{ marginTop: 12 }}>
              <Notice kind="info" text="Yüz egzersizi ve masajının etkisi için bilimsel kanıt sınırlıdır; sonuç garanti edilmez." />
            </View>
          ) : null}
          <Text variant="heading" style={{ marginTop: 16, marginBottom: 10 }}>
            Antrenmanlar
          </Text>
          {cards.map((x) => (
            <CardTile key={x.id} hero={x.hero} title={x.title} moves={x.moveCount} minutes={x.estimatedMinutes} onPress={() => router.push({ pathname: '/workout-card/[id]', params: { id: x.id } })} />
          ))}
          <Text variant="heading" style={{ marginTop: 8, marginBottom: 10 }}>
            Hareketler
          </Text>
          <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16 }}>
            {region.moves.map((m, i) => (
              <ListRow key={m.id} icon="body-outline" title={m.title} subtitle={LEVEL_TEXT[m.level] ?? m.level} onPress={() => router.push(`/library-item/${m.id}`)} last={i === region.moves.length - 1} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
