// Kütüphane içeriği: hareket/masaj (yapılış, dikkat, "Görevime ekle") ya da beslenme rehberi (okuma kartı).
import type { LibraryItemDetail } from '@fitapp/api-client';
import { Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatShort } from '@/demo/dates';
import { durationText, LEVEL_TEXT } from './labels';

// Görev bugüne ya da önümüzdeki birkaç güne eklenebilir
const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((offset) => ({ key: dateKey(offset), label: offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : formatShort(dateKey(offset)) }));

export function LibraryItemScreen() {
  const router = useRouter();
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
                <Text variant="body" tone="secondary" style={{ marginBottom: 4 }}>
                  Çalışan bölgeler: {[...item.primary, ...item.secondary].join(', ')}
                </Text>
              ) : null}

              <SectionHeader title="Nasıl yapılır" />
              <Card>
                {item.steps.map((s, i) => (
                  <Text key={s} variant="body" style={{ marginBottom: 6 }}>
                    {i + 1}. {s}
                  </Text>
                ))}
              </Card>
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
