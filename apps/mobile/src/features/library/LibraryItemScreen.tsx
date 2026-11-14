// Kütüphane içeriği: hareket/masaj (yapılış, dikkat, "Görevime ekle") ya da beslenme rehberi (okuma kartı).
import type { LibraryItemDetail } from '@fitapp/api-client';
import { Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatShort } from '@/demo/dates';
import { HeroImage } from '@/features/workout/CardHero';
import { DEMO_CREDITS, heroFor } from '@/features/workout/demoMedia';
import { EvidenceBlock } from './EvidenceBlock';
import { durationText, LEVEL_TEXT } from './labels';

// Görev bugüne ya da önümüzdeki birkaç güne eklenebilir
const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({ key: dateKey(offset), label: offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : formatShort(dateKey(offset)) }));

export function LibraryItemScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(DAY_OPTIONS[0]!.key);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .libraryItem(id)
      .then(setItem)
      .catch((e) => setError(errorText(e)));
  }, [id]);

  const addTask = async () => {
    setBusy(true);
    try {
      await api.addLibraryTask(id, day);
      showToast(`${DAY_OPTIONS.find((d) => d.key === day)?.label ?? ''} görevlerine eklendi`);
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));

  return (
    <Screen>
      <ScreenHeader title={item?.title ?? 'İçerik'} subtitle={item ? item.categoryLabel : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {item ? (
        <>
          {item.kind === 'MOVE' ? (
            <>
              <HeroImage hero={heroFor(item)} height={200} />
              <Text variant="micro" tone="muted" style={{ marginTop: 4, marginBottom: 10 }}>
                Geçici demo görseli · {DEMO_CREDITS[heroFor(item)]?.author} · {DEMO_CREDITS[heroFor(item)]?.license} · Wikimedia Commons
              </Text>
              {item.evidence.nameEn ? (
                <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
                  {item.evidence.nameEn}
                </Text>
              ) : null}
            </>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <Tag label={LEVEL_TEXT[item.level] ?? item.level} kind="info" />
            {item.equipment ? <Tag label={item.equipment} /> : null}
            {item.kind === 'GUIDE' ? <Tag label={`${item.minutes ?? 2} dk okuma`} /> : null}
          </View>

          {item.kind === 'GUIDE' ? (
            <>
              <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
                {item.summary}
              </Text>
              {item.sections.map((s) => (
                <Card key={s.heading}>
                  <Text variant="bodyStrong">{s.heading}</Text>
                  <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
                    {s.text}
                  </Text>
                </Card>
              ))}
              <Notice kind="info" text="Genel bilgidir, tanı veya kişiye özel tavsiye değildir. Sana uygun planı diyetisyenin belirler." />
            </>
          ) : (
            <>
              <Card variant="soft">
                <Text variant="caption" tone="secondary">
                  Önerilen
                </Text>
                <Text variant="heading">{item.workText}</Text>
                <Text variant="caption" tone="muted">
                  Toplam ~{durationText(item.durationSec ?? 0)}
                </Text>
              </Card>
              {item.primary.length ? (
                <>
                  <SectionHeader title="Hedef bölge" />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {item.primary.map((m) => (
                      <Tag key={m} label={m} kind="accent" />
                    ))}
                    {item.secondary.map((m) => (
                      <Tag key={m} label={m} />
                    ))}
                  </View>
                </>
              ) : null}

              <SectionHeader title="Nasıl yapılır" />
              {item.steps.map((s, i) => (
                <View key={s} style={{ flexDirection: 'row', gap: 12, backgroundColor: c.surfaceAlt, borderRadius: 16, padding: 12, marginBottom: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="caption" style={{ color: accent }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text variant="body" style={{ flex: 1 }}>
                    {s}
                  </Text>
                </View>
              ))}
              {item.mistakes.length ? (
                <>
                  <SectionHeader title="Sık yapılan hatalar" />
                  <Card>
                    {item.mistakes.map((m) => (
                      <Text key={m} variant="body" tone="secondary" style={{ marginBottom: 4 }}>
                        • {m}
                      </Text>
                    ))}
                  </Card>
                </>
              ) : null}
              {item.warnings.map((w) => (
                <Notice key={w} kind="warning" text={w} />
              ))}

              {item.kind === 'MOVE' || item.kind === 'FACE' ? <EvidenceBlock item={item} /> : null}

              {item.cards.length ? (
                <>
                  <SectionHeader title="Sıralı antrenmanda yap" />
                  <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
                    Nereden başlayacağını düşünme: sırası ve dinlenmesi hazır bir antrenmanı seç.
                  </Text>
                  <Card padded={false} style={{ paddingHorizontal: 16 }}>
                    {item.cards.map((c, i) => (
                      <ListRow key={c.id} icon="list-outline" title={c.title} subtitle={`${c.categoryLabel} · ~${c.estimatedMinutes} dk`} onPress={() => router.push(`/workout-card/${c.id}`)} last={i === item.cards.length - 1} />
                    ))}
                  </Card>
                </>
              ) : null}

              <SectionHeader title="Görevime ekle" />
              <ChipRow options={DAY_OPTIONS} selected={[day]} onToggle={setDay} />
              <Button label="Görevime ekle" icon="add-circle-outline" onPress={addTask} disabled={busy} block style={{ marginTop: 12 }} />
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
