// Keşfet: arama (kişi, gönderi, etiket, uzman, salon), branş ve şehir filtresi.
// Arama boşken "Topluluklar" (öne çıkan gönderiler) ve yükselen etiketler görünür. Etiket seçilince o etiketin gönderileri.
import type { PostView, SearchResult, SearchType, SportRef } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Chip, EmptyState, Icon, Screen, ScreenHeader, SearchBar, SectionHeader, Text, TextField, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { ChipRow } from '@/components/ChipRow';
import { PersonRow } from '@/components/social/PersonRow';
import { PostCard } from '@/components/social/PostCard';

const TYPES: { key: SearchType; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'users', label: 'Kişiler' },
  { key: 'posts', label: 'Gönderiler' },
  { key: 'tags', label: 'Etiketler' },
  { key: 'pros', label: 'Uzmanlar' },
  { key: 'gyms', label: 'Salonlar' },
];

function TagRow({ tag, posts, onPress }: { tag: string; posts: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="heading">#</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">#{tag}</Text>
        <Text variant="caption" tone="secondary">
          {posts.toLocaleString('tr-TR')} gönderi
        </Text>
      </View>
    </Pressable>
  );
}

type TagPage = { count: number; items: PostView[]; nextCursor: string | null };

export function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string }>();
  const [q, setQ] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const [sport, setSport] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sports, setSports] = useState<SportRef[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [explore, setExplore] = useState<{ posts: PostView[]; tags: { tag: string; posts: number }[] } | null>(null);
  const [tag, setTag] = useState<string | null>(params.tag ?? null);
  const [tagPage, setTagPage] = useState<TagPage | null>(null);

  useEffect(() => {
    api.socialSports().then(setSports).catch(() => setSports([]));
    api.explore().then(setExplore).catch(() => setExplore({ posts: [], tags: [] }));
  }, []);

  const active = q.trim().length > 0 || sport !== null || city.trim().length > 0 || type === 'pros' || type === 'gyms';

  // Yazmayı bitirince ara (kısa bekleme)
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      api
        .search({ q: q.trim(), type, sport: sport ?? undefined, city: city.trim() || undefined })
        .then(setResult)
        .catch(() => setResult(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, type, sport, city, active]);

  useEffect(() => {
    if (!tag) return;
    api
      .tagPosts(tag)
      .then((p) => setTagPage({ count: p.count, items: p.items, nextCursor: p.nextCursor }))
      .catch(() => setTagPage({ count: 0, items: [], nextCursor: null }));
  }, [tag]);

  const back = () => {
    // Keşfet içinden açılan etiket sayfasından aramaya dönülür
    if (tag && !params.tag) {
      setTag(null);
      setTagPage(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const replaceIn = (list: PostView[], next: PostView) => list.map((p) => (p.id === next.id ? next : p));
  const filterCount = (sport ? 1 : 0) + (city.trim() ? 1 : 0);

  // ── Etiket sayfası ──
  if (tag) {
    return (
      <Screen>
        <ScreenHeader title={`#${tag}`} subtitle={tagPage ? `${tagPage.count.toLocaleString('tr-TR')} gönderi` : undefined} onBack={back} />
        {tagPage && tagPage.items.length === 0 ? <EmptyState icon="pricetag-outline" title="Bu etiketle gönderi yok" /> : null}
        {tagPage?.items.map((p) => (
          <PostCard key={p.id} post={p} onChange={(n) => setTagPage((tp) => (tp ? { ...tp, items: replaceIn(tp.items, n) } : tp))} />
        ))}
        {tagPage?.nextCursor ? (
          <Button
            label="Daha fazla"
            variant="ghost"
            onPress={async () => {
              const next = await api.tagPosts(tag, tagPage.nextCursor ?? undefined);
              setTagPage((tp) => (tp ? { ...tp, items: [...tp.items, ...next.items], nextCursor: next.nextCursor } : tp));
            }}
          />
        ) : null}
      </Screen>
    );
  }

  const r = active ? result : null;
  const nothing = r && !r.users.length && !r.pros.length && !r.gyms.length && !r.tags.length && !r.posts.length;

  return (
    <Screen>
      <ScreenHeader title="Keşfet" onBack={back} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Kişi, gönderi, #etiket, uzman, salon" />
        </View>
        <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" accessibilityLabel={filterCount ? `Filtreler (${filterCount})` : 'Filtreler'} hitSlop={6} style={{ padding: 8 }}>
          <Icon name={filterCount ? 'options' : 'options-outline'} size={24} />
        </Pressable>
      </View>
      <View style={{ height: 10 }} />
      <ChipRow options={TYPES} selected={[type]} onToggle={setType} />

      {!active ? (
        <>
          {explore?.tags.length ? (
            <>
              <SectionHeader title="Yükselen etiketler" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {explore.tags.map((t) => (
                  <Chip key={t.tag} label={`#${t.tag}`} onPress={() => setTag(t.tag)} />
                ))}
              </View>
            </>
          ) : null}
          <SectionHeader title="Topluluklar" />
          {explore && explore.posts.length === 0 ? <EmptyState icon="people-outline" title="Henüz öne çıkan paylaşım yok" /> : null}
          {explore?.posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={(n) => setExplore((e) => (e ? { ...e, posts: replaceIn(e.posts, n) } : e))} />
          ))}
        </>
      ) : null}

      {nothing ? <EmptyState icon="search-outline" title="Sonuç bulunamadı" text="Farklı bir kelime ya da filtre dene." /> : null}

      {r?.users.length ? (
        <>
          <SectionHeader title="Kişiler" action={type === 'all' ? 'Tümü' : undefined} onAction={() => setType('users')} />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {r.users.map((u, i) => (
              <PersonRow key={u.id} person={u} last={i === r.users.length - 1} />
            ))}
          </Card>
        </>
      ) : null}
      {r?.pros.length ? (
        <>
          <SectionHeader title="Uzmanlar" action={type === 'all' ? 'Tümü' : undefined} onAction={() => setType('pros')} />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {r.pros.map((u, i) => (
              <PersonRow
                key={u.id}
                person={u}
                last={i === r.pros.length - 1}
                trailing={
                  <Text variant="micro" tone="muted" numberOfLines={2} style={{ maxWidth: 110, textAlign: 'right' }}>
                    {[u.title, u.city].filter(Boolean).join(' · ')}
                  </Text>
                }
              />
            ))}
          </Card>
        </>
      ) : null}
      {r?.gyms.length ? (
        <>
          <SectionHeader title="Salonlar" action={type === 'all' ? 'Tümü' : undefined} onAction={() => setType('gyms')} />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {r.gyms.map((g, i) => (
              <PersonRow
                key={g.id}
                person={{ ...g.owner, displayName: g.name }}
                last={i === r.gyms.length - 1}
                trailing={
                  <Text variant="micro" tone="muted">
                    {g.city ?? ''}
                  </Text>
                }
              />
            ))}
          </Card>
        </>
      ) : null}
      {r?.tags.length ? (
        <>
          <SectionHeader title="Etiketler" action={type === 'all' ? 'Tümü' : undefined} onAction={() => setType('tags')} />
          <Card style={{ paddingVertical: 4 }}>
            {r.tags.map((t) => (
              <TagRow key={t.tag} tag={t.tag} posts={t.posts} onPress={() => setTag(t.tag)} />
            ))}
          </Card>
        </>
      ) : null}
      {r?.posts.length ? (
        <>
          <SectionHeader title="Gönderiler" action={type === 'all' ? 'Tümü' : undefined} onAction={() => setType('posts')} />
          {r.posts.map((p) => (
            <PostCard key={p.id} post={p} onChange={(n) => setResult((res) => (res ? { ...res, posts: replaceIn(res.posts, n) } : res))} />
          ))}
        </>
      ) : null}

      <BottomSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtreler">
        <Text variant="bodyStrong" style={{ marginBottom: 8 }}>
          Spor branşı
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {sports.map((s) => (
            <Chip key={s.id} label={s.name} selected={sport === s.id} onPress={() => setSport(sport === s.id ? null : s.id)} />
          ))}
        </View>
        <TextField label="Şehir" value={city} onChangeText={setCity} placeholder="Örn. İzmir" autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Temizle"
              variant="secondary"
              block
              onPress={() => {
                setSport(null);
                setCity('');
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Uygula" block onPress={() => setFiltersOpen(false)} />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}
