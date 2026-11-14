// Kütüphane: uygulamanın ücretsiz programları, hareketleri, yüz masajları ve beslenme rehberleri.
// İçerik genel bilgidir; kişiye özel program uzmandan gelir (Programım sekmesi).
import type { BodyAreaKey, LibraryItemCard, LibraryProgramCard, WorkoutCardSummary } from '@fitapp/api-client';
import { Card, Chip, EmptyState, Icon, ListRow, Notice, Screen, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { SocialHeader } from '@/components/social/SocialHeader';
import { CardTile } from '@/features/workout/CardHero';
import { RestrictionPicker } from '@/features/workout/RestrictionPicker';
import { durationText, LEVEL_TEXT, programMeta } from './labels';

type Section = 'cards' | 'programs' | 'moves' | 'face' | 'nutrition';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'cards', label: 'Antrenmanlar' },
  { key: 'programs', label: 'Programlar' },
  { key: 'moves', label: 'Hareketler' },
  { key: 'face', label: 'Yüz masajı' },
  { key: 'nutrition', label: 'Beslenme' },
];

export function LibraryScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [section, setSection] = useState<Section>('cards');
  const [data, setData] = useState<{ items: LibraryItemCard[]; programs: LibraryProgramCard[] } | null>(null);
  const [cards, setCards] = useState<WorkoutCardSummary[]>([]);
  const [avoid, setAvoid] = useState<BodyAreaKey[]>([]);
  const [cat, setCat] = useState<string>('all');
  const [showRestr, setShowRestr] = useState(false);
  const [query, setQuery] = useState('');
  const [short, setShort] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .library()
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, []),
  );
  // Kısıt seçimi değişince kart süreleri ve hareket sayıları yeniden gelir
  useEffect(() => {
    api
      .workoutCards(avoid)
      .then((r) => setCards(r.cards))
      .catch((e) => setError(errorText(e)));
  }, [avoid]);
  // Filtre çipleri: kısa süre, tümü ve hedef bölgeler (yalnızca var olanlar; karışıklık olmasın)
  const areaChips = [...new Set(cards.flatMap((c) => c.areas))].map((a) => ({ key: a, label: a }));
  const q = query.trim().toLocaleLowerCase('tr');
  const shownCards = cards.filter(
    (c) =>
      (cat === 'all' || c.areas.includes(cat)) &&
      (!short || c.estimatedMinutes <= 15) &&
      (!q || `${c.title} ${c.region} ${c.categoryLabel} ${c.goal} ${c.areas.join(' ')}`.toLocaleLowerCase('tr').includes(q)),
  );

  const items = (data?.items ?? []).filter((i) =>
    section === 'moves' ? i.kind === 'MOVE' : section === 'face' ? i.kind === 'FACE' : section === 'nutrition' ? i.kind === 'GUIDE' : false,
  );
  // Hareketler kategoriye göre gruplanır (Evde, Salon, Duruş ve esneme)
  const groups = [...new Set(items.map((i) => i.categoryLabel))];

  return (
    <Screen tabBarInset>
      <SocialHeader title="Kütüphane" />
      <Card padded={false} variant="soft" style={{ paddingHorizontal: 16 }}>
        <ListRow icon="sparkles-outline" title="Kişisel 28 günlük program" subtitle="Hedefine ve seviyene göre hazırlanır, ilerlemene göre güncellenir" onPress={() => router.push('/plan')} last />
      </Card>
      <ChipRow options={SECTIONS} selected={[section]} onToggle={setSection} />
      <View style={{ height: 12 }} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {section === 'cards' ? (
        <>
          <Text variant="title" style={{ marginBottom: 10 }}>
            Günlük Antrenmanlar
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceAlt, borderRadius: 16, paddingHorizontal: 14, height: 48, marginBottom: 12 }}>
            <Icon name="search-outline" size={20} color={c.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Antrenman ara" placeholderTextColor={c.textMuted} accessibilityLabel="Antrenman ara" style={{ flex: 1, fontSize: 15, color: c.text }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }} style={{ marginHorizontal: -16 }}>
            <Chip label="Kısa süre" icon="swap-vertical-outline" selected={short} onPress={() => setShort((v) => !v)} />
            {[{ key: 'all', label: 'Tümü' }, ...areaChips].map((o) => (
              <Chip key={o.key} label={o.label} selected={cat === o.key} onPress={() => setCat(o.key)} />
            ))}
          </ScrollView>
          {shownCards.map((card) => (
            <CardTile key={card.id} hero={card.hero} title={card.title} moves={card.moveCount} minutes={card.estimatedMinutes} onPress={() => router.push({ pathname: '/workout-card/[id]', params: { id: card.id, avoid: avoid.join(',') } })} />
          ))}
          {shownCards.length === 0 ? <EmptyState icon="search-outline" title="Antrenman bulunamadı" text="Aramayı ya da filtreyi değiştir." /> : null}
          <Text variant="caption" tone="secondary" style={{ marginVertical: 8 }} onPress={() => setShowRestr((v) => !v)}>
            {showRestr ? '▾' : '▸'} Ağrı ya da sakatlığım var{avoid.length ? ` (${avoid.length})` : ''}
          </Text>
          {showRestr ? <RestrictionPicker value={avoid} onChange={setAvoid} /> : null}
          <Notice kind="info" text="Yüz egzersizleri ve masajı için bilimsel kanıt sınırlıdır; bu yüzden hazır bir yüz antrenmanı yoktur." />
        </>
      ) : null}

      {section === 'programs'
        ? data?.programs.map((p) => (
            <Card key={p.id} onPress={() => router.push(`/library-program/${p.id}`)}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                <Tag label="Ücretsiz" kind="success" />
                <Tag label={p.categoryLabel} />
                <Tag label={LEVEL_TEXT[p.level] ?? p.level} kind="info" />
              </View>
              <Text variant="heading">{p.title}</Text>
              <Text variant="body" tone="secondary" style={{ marginTop: 2 }}>
                {p.description}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                {programMeta(p)}
              </Text>
            </Card>
          ))
        : null}

      {section === 'face' ? <Notice kind="info" text="Cildin hassassa, yüzünde yara veya iltihap varsa masaj yapma." /> : null}
      {section === 'nutrition' ? <Notice kind="info" text="Bunlar genel bilgi kartlarıdır. Sana özel beslenme planı için bir diyetisyenle çalış." /> : null}

      {section !== 'programs'
        ? groups.map((g) => (
            <View key={g}>
              {section === 'moves' ? (
                <Text variant="subheading" style={{ marginTop: 8, marginBottom: 8 }}>
                  {g}
                </Text>
              ) : null}
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {items
                  .filter((i) => i.categoryLabel === g)
                  .map((i, idx, arr) => (
                    <ListRow
                      key={i.id}
                      icon={i.kind === 'GUIDE' ? 'book-outline' : i.kind === 'FACE' ? 'happy-outline' : 'barbell-outline'}
                      title={i.title}
                      subtitle={i.kind === 'GUIDE' ? `${i.minutes ?? 2} dk okuma · ${i.summary}` : `${i.workText ?? ''} · ~${durationText(i.durationSec ?? 0)}`}
                      onPress={() => router.push(`/library-item/${i.id}`)}
                      last={idx === arr.length - 1}
                    />
                  ))}
              </Card>
            </View>
          ))
        : null}

      {data && section !== 'programs' && section !== 'cards' && items.length === 0 ? <EmptyState icon="albums-outline" title="Bu bölümde içerik yok" /> : null}
    </Screen>
  );
}
