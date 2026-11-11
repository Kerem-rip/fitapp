// Panelde "bugün ne yapmalıyım" (gerçek hesaplar): inceleme bekleyen danışanlar ve takip görevleri.
// Danışan sağlık verisinin içeriğini göstermez; sadece sayıları gösterir. Ayrıntı danışan dosyasında, denetim kaydıyla açılır.
import type { ReviewOverviewItem, ReviewTask } from '@fitapp/api-client';
import { Button, Card, ListRow, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { dueLabel } from '@/features/review/labels';

const nameOf = (c: ReviewOverviewItem['client']) => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username;

export function RealWorkQueue() {
  const router = useRouter();
  const [overview, setOverview] = useState<ReviewOverviewItem[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);

  const load = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([api.reviewOverview(), api.reviewTasks()]);
      setOverview(o);
      setTasks(t);
    } catch {
      // Sunucuya ulaşılamıyorsa bu bölüm sessizce boş kalır (panelin geri kalanı demo veriyle çalışır)
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const needsReview = overview.filter((o) => o.red + o.yellow + o.openTasks > 0);
  if (needsReview.length === 0 && tasks.length === 0) return null;

  const complete = async (task: ReviewTask) => {
    try {
      await api.completeTask(task.id);
      showToast('Görev tamamlandı', 'info');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      <SectionHeader title="Bugün ne yapmalıyım?" />
      {needsReview.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          {needsReview.map((o, i) => (
            <ListRow
              key={o.client.id}
              avatar={nameOf(o.client)}
              title={nameOf(o.client)}
              subtitle="İnceleme bekliyor"
              trailing={
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {o.red > 0 ? <Tag label={`${o.red}`} kind="danger" /> : null}
                  {o.yellow > 0 ? <Tag label={`${o.yellow}`} kind="warning" /> : null}
                  {o.followUp > 0 ? <Tag label={`${o.followUp} takipte`} kind="info" /> : null}
                </View>
              }
              onPress={() => router.push(`/client-file/${o.client.id}`)}
              last={i === needsReview.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {tasks.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {tasks.slice(0, 6).map((t, i, list) => {
            const d = dueLabel(t.dueAt);
            return (
              <ListRow
                key={t.id}
                icon="alarm-outline"
                title={t.title}
                subtitle={`${t.client.name} · ${d.text}`}
                trailing={<Button label="Tamamla" size="sm" variant="secondary" onPress={() => complete(t)} />}
                last={i === list.length - 1}
              />
            );
          })}
          {tasks.length > 6 ? (
            <Text variant="caption" tone="muted" style={{ paddingVertical: 10 }}>
              +{tasks.length - 6} görev daha
            </Text>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
