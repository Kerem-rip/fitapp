// Danışan dosyasının "Plan" sekmesi: yayındaki sürüm, açık taslak, sürüm geçmişi ve danışanın seçimleri.
import type { ClientPlanChoice, PlanOverview } from '@fitapp/api-client';
import { Button, Card, EmptyState, Notice, SectionHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatDateTime } from '@/features/sharing/labels';
import { allergenText } from './helpers';

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export function PlanTab({ clientId, mealsVisible }: { clientId: string; mealsVisible: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<PlanOverview | null>(null);
  const [choices, setChoices] = useState<ClientPlanChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .clientPlan(clientId)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
      if (mealsVisible) {
        api.clientPlanChoices(clientId, isoDay(-7), isoDay(1)).then(setChoices).catch(() => setChoices([]));
      }
    }, [clientId, mealsVisible]),
  );

  if (error) return <Notice kind="danger" text={error} />;
  if (!data) return <Text tone="muted">Yükleniyor...</Text>;

  const published = data.published;
  return (
    <>
      {data.openPlanFindings > 0 ? (
        <Notice
          kind="danger"
          title="Yayındaki plan yeniden incelenmeli"
          text="Danışanın alerji bilgisi değişti ve bazı seçenekler çakışıyor. Bu seçenekler danışana şimdilik seçilemez gösteriliyor. Ayrıntı İnceleme sekmesinde; düzeltip yeni sürüm yayınla."
        />
      ) : null}

      <Button
        label={data.draft ? 'Taslağı düzenle' : published ? 'Yeni sürüm hazırla' : 'Plan hazırla'}
        icon="create-outline"
        size="lg"
        block
        onPress={() => router.push(`/plan-editor/${clientId}`)}
        style={{ marginBottom: 12 }}
      />
      {data.draft ? <Notice kind="info" text={`Açık taslak var (son kayıt ${formatDateTime(data.draft.updatedAt)}). Taslak danışana görünmez.`} /> : null}

      <SectionHeader title="Yayındaki plan" />
      {published ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Tag label={`Sürüm ${published.number}`} kind="success" />
          </View>
          <Text variant="heading">{published.content.title ?? 'Beslenme planı'}</Text>
          <Text variant="caption" tone="secondary">
            {published.approvedBy ?? 'Uzman'} onayladı · {published.approvedAt ? formatDateTime(published.approvedAt) : ''}
            {published.content.targetKcal !== undefined ? ` · hedef ${published.content.targetKcal} kcal` : ''}
          </Text>
          {published.content.meals.map((m) => (
            <View key={m.id} style={{ marginTop: 10 }}>
              <Text variant="bodyStrong">
                {m.time ? `${m.time} · ` : ''}
                {m.name} <Text variant="caption" tone="muted">({m.pick} seçim)</Text>
              </Text>
              {m.options.map((o) => (
                <Text key={o.id} variant="caption" tone="secondary">
                  • {o.name} · {o.portion} · {allergenText(o.allergens)}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState icon="restaurant-outline" title="Henüz yayınlanmış plan yok" text="Hazırladığın plan, sen onaylayınca danışana yayınlanır." />
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
                {v.approvedBy ?? 'Uzman'} · {v.approvedAt ? formatDateTime(v.approvedAt) : ''}
                {v.basedOnNumber ? ` · sürüm ${v.basedOnNumber} temel alındı` : ''}
              </Text>
              {v.changeNote ? (
                <Text variant="body" style={{ marginTop: 4 }}>
                  {v.changeNote}
                </Text>
              ) : null}
              {v.summary.map((line, i) => (
                <Text key={i} variant="micro" tone="muted">
                  • {line}
                </Text>
              ))}
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Danışanın seçimleri (son 7 gün)" />
      {!mealsVisible ? (
        <Text variant="caption" tone="muted">
          Danışan öğün kayıtlarını paylaşmıyor; seçimleri görünmez.
        </Text>
      ) : choices.length === 0 ? (
        <Text variant="caption" tone="muted">
          Henüz seçim yok.
        </Text>
      ) : (
        <Card>
          {choices.map((c) => (
            <Text key={`${c.date}-${c.mealId}`} variant="caption" style={{ marginBottom: 4 }}>
              {c.date} · {c.mealName}: {c.options.map((o) => o.name).join(', ')}
              {c.versionNumber ? ` (sürüm ${c.versionNumber})` : ''}
            </Text>
          ))}
        </Card>
      )}
    </>
  );
}
