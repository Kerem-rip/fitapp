// Egzersiz Kütüphanesi: Antrenmanlar (bölge kutuları), Programlar (28 günlük paketler ve programlar), Yüz Egzersizi ve Masajlar.
// Hareketler ayrı bir sekme değildir: bölgelerin içinde ve aramada bulunur. Beslenme burada değildir.
import type { LibraryItemCard, LibraryProgramCard, WorkoutCardSummary, WorkoutRegion } from '@fitapp/api-client';
import { Chip, EmptyState, Icon, ListRow, Notice, Screen, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { SocialHeader } from '@/components/social/SocialHeader';
import { CardTile, HeroImage, RegionTile } from '@/features/workout/CardHero';
import { LEVEL_TEXT } from './labels';

type Tab = 'workouts' | 'programs' | 'face';
const TABS: { key: Tab; label: string }[] = [
  { key: 'workouts', label: 'Antrenmanlar' },
  { key: 'programs', label: 'Programlar' },
  { key: 'face', label: 'Yüz Egzersizi ve Masajlar' },
];
const GROUPS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'yoga', label: 'Yoga' },
  { key: 'pilates', label: 'Pilates' },
  { key: 'posture', label: 'Postür' },
  { key: 'cardio', label: 'Kardiyo' },
  { key: 'mobility', label: 'Mobilite' },
  { key: 'sport', label: 'Spor' },
];

function Pill({ text, tone }: { text: string; tone: 'free' | 'earth' }) {
  const { c } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: tone === 'earth' ? c.earth : 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text variant="micro" style={{ color: tone === 'earth' ? '#FFFFFF' : '#202724' }}>
        {text}
      </Text>
    </View>
  );
}

// Program kartı: görsel, üstte etiket, altta başlık ve bilgi
function ProgramTile({ p, onPress }: { p: LibraryProgramCard; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${p.title}, ${p.totalDays} antrenman günü`} style={{ marginBottom: 14 }}>
      <HeroImage hero={p.hero} height={190} />
      <View style={{ position: 'absolute', left: 16, top: 14 }}>
        <Pill text="Ücretsiz" tone="free" />
      </View>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
        <Text variant="heading" style={{ color: '#FFFFFF' }}>
          {p.title}
        </Text>
        <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {p.weeks} hafta · haftada {p.daysPerWeek} gün · ~{p.minutesPerDay} dk · {LEVEL_TEXT[p.level] ?? p.level}
        </Text>
      </View>
    </Pressable>
  );
}

export function LibraryScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('workouts');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [regions, setRegions] = useState<WorkoutRegion[]>([]);
  const [cards, setCards] = useState<WorkoutCardSummary[]>([]);
  const [programs, setPrograms] = useState<LibraryProgramCard[]>([]);
  const [items, setItems] = useState<LibraryItemCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.workoutCards(), api.library()])
        .then(([w, lib]) => {
          setRegions(w.regions);
          setCards(w.cards);
          setPrograms(lib.programs);
          setItems(lib.items.filter((i) => i.kind === 'MOVE' || i.kind === 'FACE'));
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );

  const q = query.trim().toLocaleLowerCase('tr');
  const open = (r: WorkoutRegion) => router.push({ pathname: '/region/[key]', params: { key: r.key } });
  const goCard = (id: string) => router.push({ pathname: '/workout-card/[id]', params: { id } });
  const goProgram = (id: string) => router.push(`/library-program/${id}`);
  const isFace = tab === 'face';
  const regionList = regions.filter((r) => (r.category === 'face') === isFace);

  // Arama: bölgeler, antrenmanlar ve hareketler birlikte aranır
  const matchedRegions = regionList.filter((r) => (isFace || group === 'all' || r.category === group) && (!q || r.title.toLocaleLowerCase('tr').includes(q)));
  const matchedCards = q ? cards.filter((x) => (x.category === 'face') === isFace && `${x.title} ${x.region} ${x.goal}`.toLocaleLowerCase('tr').includes(q)) : [];
  const matchedItems = q ? items.filter((i) => (i.kind === 'FACE') === isFace && `${i.title} ${i.summary}`.toLocaleLowerCase('tr').includes(q)).slice(0, 20) : [];
  const packs = programs.filter((p) => p.kind === 'PACK');
  const classics = programs.filter((p) => p.kind === 'PROGRAM');
  const faceRoutines = cards.filter((x) => ['face-morning', 'face-evening'].includes(x.id));

  return (
    <Screen tabBarInset>
      <SocialHeader title="Egzersiz Kütüphanesi" />
      <ChipRow options={TABS} selected={[tab]} onToggle={setTab} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {tab !== 'programs' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceAlt, borderRadius: 16, paddingHorizontal: 14, height: 48, marginBottom: 12 }}>
            <Icon name="search-outline" size={20} color={c.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder={isFace ? 'Yüz hareketi ara' : 'Bölge, antrenman ya da hareket ara'} placeholderTextColor={c.textMuted} accessibilityLabel="Ara" style={{ flex: 1, fontSize: 15, color: c.text }} />
          </View>
          {!isFace ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }} style={{ marginHorizontal: -16 }}>
              {GROUPS.map((g) => (
                <Chip key={g.key} label={g.label} selected={group === g.key} onPress={() => setGroup(g.key)} />
              ))}
            </ScrollView>
          ) : null}

          {isFace && !q ? (
            <>
              <Notice kind="info" text="Yüz egzersizi ve masajının etkisi için bilimsel kanıt sınırlıdır; sonuç garanti edilmez. Cildin hassassa ya da yüzünde yara varsa uygulama." />
              {faceRoutines.map((x) => (
                <CardTile key={x.id} hero={x.hero} title={x.title} moves={x.moveCount} minutes={x.estimatedMinutes} onPress={() => goCard(x.id)} />
              ))}
              <Text variant="heading" style={{ marginTop: 6, marginBottom: 10 }}>
                Bölgelere göre
              </Text>
            </>
          ) : null}

          {matchedRegions.map((r) => (
            <RegionTile key={r.key} hero={r.hero} title={r.title} subtitle={`${r.moveCount} Hareket · ${r.cardCount} antrenman`} onPress={() => open(r)} />
          ))}

          {matchedCards.length ? (
            <>
              <Text variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>
                Antrenmanlar
              </Text>
              {matchedCards.map((x) => (
                <CardTile key={x.id} hero={x.hero} title={x.title} moves={x.moveCount} minutes={x.estimatedMinutes} onPress={() => goCard(x.id)} />
              ))}
            </>
          ) : null}
          {matchedItems.length ? (
            <>
              <Text variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>
                Hareketler
              </Text>
              <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16 }}>
                {matchedItems.map((i, idx) => (
                  <ListRow key={i.id} icon="body-outline" title={i.title} subtitle={i.summary} onPress={() => router.push(`/library-item/${i.id}`)} last={idx === matchedItems.length - 1} />
                ))}
              </View>
            </>
          ) : null}
          {q && matchedRegions.length + matchedCards.length + matchedItems.length === 0 ? <EmptyState icon="search-outline" title="Sonuç bulunamadı" text="Başka bir kelime dene." /> : null}
        </>
      ) : (
        <>
          {/* Kişisel 28 günlük program: sunucudaki mevcut ürün */}
          <Pressable onPress={() => router.push('/plan')} accessibilityRole="button" accessibilityLabel="28 Günlük Kişisel Dönüşüm" style={{ marginBottom: 18 }}>
            <HeroImage hero="fullbody" height={210} />
            <View style={{ position: 'absolute', left: 18, top: 16 }}>
              <Pill text="Premium" tone="earth" />
            </View>
            <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
              <Text variant="title" style={{ color: '#FFFFFF' }}>
                28 Günlük Kişisel Dönüşüm
              </Text>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
                Hedefine, seviyene ve zamanına göre hazırlanır; ilerlemene göre güncellenir.
              </Text>
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10 }}>
                <Text variant="bodyStrong" style={{ color: '#244A3B' }}>
                  Programı incele
                </Text>
              </View>
            </View>
          </Pressable>

          <Text variant="heading" style={{ marginBottom: 10 }}>
            28 Günlük Paketler
          </Text>
          {packs.map((p) => (
            <ProgramTile key={p.id} p={p} onPress={() => goProgram(p.id)} />
          ))}
          <Text variant="heading" style={{ marginTop: 6, marginBottom: 10 }}>
            Programlar
          </Text>
          {classics.map((p) => (
            <ProgramTile key={p.id} p={p} onPress={() => goProgram(p.id)} />
          ))}
        </>
      )}
    </Screen>
  );
}
