// Kütüphane: uygulamanın ücretsiz programları, hareketleri, yüz masajları ve beslenme rehberleri.
// İçerik genel bilgidir; kişiye özel program uzmandan gelir (Programım sekmesi).
import type { LibraryItemCard, LibraryProgramCard } from '@fitapp/api-client';
import { Card, EmptyState, ListRow, Notice, Screen, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { SocialHeader } from '@/components/social/SocialHeader';
import { durationText, LEVEL_TEXT, programMeta } from './labels';

type Section = 'programs' | 'moves' | 'face' | 'nutrition';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'programs', label: 'Programlar' },
  { key: 'moves', label: 'Hareketler' },
  { key: 'face', label: 'Yüz masajı' },
  { key: 'nutrition', label: 'Beslenme' },
];

export function LibraryScreen() {
  const router = useRouter();
  const [section, setSection] = useState<Section>('programs');
  const [data, setData] = useState<{ items: LibraryItemCard[]; programs: LibraryProgramCard[] } | null>(null);
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

  const items = (data?.items ?? []).filter((i) =>
    section === 'moves' ? i.kind === 'MOVE' : section === 'face' ? i.kind === 'FACE' : section === 'nutrition' ? i.kind === 'GUIDE' : false,
  );
  // Hareketler kategoriye göre gruplanır (Evde, Salon, Duruş ve esneme)
  const groups = [...new Set(items.map((i) => i.categoryLabel))];

  return (
    <Screen tabBarInset>
      <SocialHeader title="Kütüphane" />
      <ChipRow options={SECTIONS} selected={[section]} onToggle={setSection} />
      <View style={{ height: 12 }} />
      {error ? <Notice kind="danger" text={error} /> : null}

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

      {data && section !== 'programs' && items.length === 0 ? <EmptyState icon="albums-outline" title="Bu bölümde içerik yok" /> : null}
    </Screen>
  );
}
