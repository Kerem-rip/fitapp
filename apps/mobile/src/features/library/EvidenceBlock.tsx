// Hareketin kaynakları, doğrulama durumu, varyasyon ilişkisi, alternatifleri ve görsel durumu.
import type { LibraryItemDetail } from '@fitapp/api-client';
import { Card, Notice, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { Linking, View } from 'react-native';
import { ALT_TYPE_TEXT, VERIFICATION_TEXT } from './labels';

export function EvidenceBlock({ item }: { item: LibraryItemDetail }) {
  const router = useRouter();
  const ev = item.evidence;
  const v = VERIFICATION_TEXT[ev.verification] ?? VERIFICATION_TEXT.none!;
  return (
    <>
      <SectionHeader title="Kaynaklar ve doğrulama" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <Tag label={v.label} kind={v.kind} />
          {ev.nameEn ? <Tag label={ev.nameEn} /> : null}
        </View>
        {ev.variationOf ? (
          <Text variant="body" tone="secondary" style={{ marginBottom: 4 }} onPress={() => router.push(`/library-item/${ev.variationOf!.id}`)}>
            Bu hareket “{ev.variationOf.title}” hareketinin bir varyasyonudur.
          </Text>
        ) : null}
        {ev.note ? (
          <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
            {ev.note}
          </Text>
        ) : null}
        {ev.sources.length ? (
          ev.sources.map((s) => (
            <Text key={s.url} variant="caption" tone="secondary" style={{ marginBottom: 2, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(s.url)}>
              • {s.publisher}
              {s.read ? '' : ' (özetten)'}
            </Text>
          ))
        ) : (
          <Text variant="caption" tone="muted">
            Bu hareketin içeriği henüz kaynaklarla karşılaştırılmadı.
          </Text>
        )}
      </Card>
      {ev.alternatives.length ? (
        <>
          <SectionHeader title="Alternatifler" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {ev.alternatives.map((a, i) => (
              <Text key={a.id} variant="body" style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: 'transparent' }} onPress={() => router.push(`/library-item/${a.id}`)}>
                {a.title} · {ALT_TYPE_TEXT[a.type] ?? a.type}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
      {item.media.status === 'MISSING' ? <Notice kind="info" text="Bu hareket için lisanslı görsel ya da video henüz eklenmedi." /> : null}
    </>
  );
}
