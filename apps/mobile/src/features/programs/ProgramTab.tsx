// Danışan dosyasının "Program" sekmesi (antrenör): yayındaki program, açık taslak ve sürüm geçmişi.
import type { ProgramOverview } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatDateTime } from '@/features/sharing/labels';

export function ProgramTab({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ProgramOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .clientProgram(clientId)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, [clientId]),
  );

  if (error) return <Notice kind="danger" text={error} />;
  if (!data) return <Text tone="muted">Yükleniyor...</Text>;
  const published = data.published;

  return (
    <>
      <Button
        label={data.draft ? 'Taslağı düzenle' : published ? 'Yeni sürüm hazırla' : 'Program hazırla'}
        icon="create-outline"
        size="lg"
        block
        onPress={() => router.push(`/program-editor/${clientId}`)}
        style={{ marginBottom: 12 }}
      />
      {data.draft ? <Notice kind="info" text={`Açık taslak var (son kayıt ${formatDateTime(data.draft.updatedAt)}). Taslak danışana görünmez.`} /> : null}

      <SectionHeader title="Yayındaki program" />
      {published ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label={`Sürüm ${published.number}`} kind="success" />
            {published.content.weeks ? <Tag label={`${published.content.weeks} hafta`} kind="neutral" /> : null}
          </View>
          <Text variant="heading">{published.content.title ?? 'Antrenman programı'}</Text>
          <Text variant="caption" tone="secondary">
            {published.approvedBy ?? 'Antrenör'} onayladı{published.approvedAt ? ` · ${formatDateTime(published.approvedAt)}` : ''}
          </Text>
          {published.content.days.map((d) => (
            <View key={d.id} style={{ marginTop: 10 }}>
              <Text variant="bodyStrong">
                {d.name}
                {d.focus ? ` · ${d.focus}` : ''}
              </Text>
              {d.exercises.map((e) => (
                <Text key={e.id} variant="caption" tone="secondary">
                  • {e.name} · {e.sets} × {e.reps}
                  {e.load ? ` · ${e.load}` : ''}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState icon="barbell-outline" title="Henüz yayınlanmış program yok" text="Hazırladığın program, sen onaylayınca danışana yayınlanır." />
      )}

      {data.versions.length > 0 ? (
        <>
          <SectionHeader title="Sürüm geçmişi" />
          {data.versions.map((v) => (
            <Card key={v.number} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                <Tag label={`Sürüm ${v.number}`} kind={v.status === 'APPROVED' ? 'success' : 'neutral'} />
                <Tag label={v.status === 'APPROVED' ? 'Yayında' : 'Eski'} kind="neutral" />
              </View>
              <Text variant="caption" tone="secondary">
                {v.approvedBy ?? 'Antrenör'} · {v.approvedAt ? formatDateTime(v.approvedAt) : ''}
              </Text>
              {v.changeNote ? <Text variant="body" style={{ marginTop: 4 }}>{v.changeNote}</Text> : null}
              {v.summary.map((line, i) => (
                <Text key={i} variant="micro" tone="muted">
                  • {line}
                </Text>
              ))}
            </Card>
          ))}
        </>
      ) : null}
    </>
  );
}
