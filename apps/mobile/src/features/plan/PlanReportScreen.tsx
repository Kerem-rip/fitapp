// Gelişim raporu: tamamlanan ve kaçırılan antrenmanlar, haftalık özet, hareket gelişimi, ölçü değişimi ve tahmini enerji.
// Tahmini değerler kesin ölçüm ya da sonuç garantisi olarak sunulmaz.
import type { PlanReportData } from '@fitapp/api-client';
import { Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, StatTile, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

const BODY: Record<string, { label: string; unit: string }> = { weightKg: { label: 'Kilo', unit: 'kg' }, waistCm: { label: 'Bel', unit: 'cm' }, hipCm: { label: 'Kalça', unit: 'cm' }, armCm: { label: 'Kol', unit: 'cm' } };

export function PlanReportScreen() {
  const router = useRouter();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const [data, setData] = useState<{ final: boolean; report: PlanReportData } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .planReport(instanceId)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [instanceId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/plan'));
  const r = data?.report;
  const pct = (x: number) => `%${Math.round(x * 100)}`;

  return (
    <Screen>
      <ScreenHeader title="Gelişim raporu" subtitle={data ? (data.final ? 'Program sona erdi' : 'Şu ana kadar (program sürüyor)') : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {r ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <StatTile label="Tamamlama" value={pct(r.totals.completionRate)} />
            </View>
            <View style={{ flex: 1 }}>
              <StatTile label="Antrenman günü" value={`${r.totals.completedDays}/${r.totals.trainingDays}`} />
            </View>
          </View>
          <Text variant="caption" tone="secondary">
            {r.totals.doneMain} hareket yapıldı, {r.totals.skippedMain} hareket yapılmadı. Ortalama zorlanma: {r.totals.avgRpe ?? '—'}/10.
          </Text>
          {r.notes.map((n) => (
            <Notice key={n} kind="info" text={n} />
          ))}

          <SectionHeader title="Haftalara göre" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {r.weeks.map((w, i) => (
              <ListRow
                key={w.week}
                icon="calendar-outline"
                title={`${w.week}. hafta`}
                subtitle={w.trainingDays ? `${w.completedDays}/${w.trainingDays} gün · ${w.doneMain}/${w.plannedMain} hareket · zorlanma ${w.avgRpe ?? '—'}${w.painReports ? ` · ${w.painReports} ağrı bildirimi` : ''}` : 'Bu hafta oluşturulmadı'}
                last={i === r.weeks.length - 1}
              />
            ))}
          </Card>

          {r.improvements.length ? (
            <>
              <SectionHeader title="Gelişen hareketler" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {r.improvements.map((x, i) => (
                  <ListRow key={x.itemId} icon="trending-up-outline" title={x.title} subtitle={`${x.firstWeek}. hafta ${x.first} → ${x.lastWeek}. hafta ${x.last} ${x.unit === 'reps' ? 'tekrar' : 'sn'}`} last={i === r.improvements.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title="Vücut ölçüleri" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {Object.entries(r.body).map(([k, v], i, arr) => (
              <ListRow
                key={k}
                icon="body-outline"
                title={BODY[k]!.label}
                subtitle={v.start !== null && v.end !== null ? `${v.start} → ${v.end} ${BODY[k]!.unit} (${v.end - v.start > 0 ? '+' : ''}${Math.round((v.end - v.start) * 10) / 10})` : v.start !== null ? `Başlangıç ${v.start} ${BODY[k]!.unit} · sonraki ölçüm kaydı yok` : 'Kayıt yok'}
                last={i === arr.length - 1}
              />
            ))}
          </Card>
          <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
            Ölçüm kayıtların ana sayfandaki ölçüm bölümünden gelir.
          </Text>

          <SectionHeader title="Tahmini enerji" />
          <Text variant="body" tone="secondary">
            Günlük ihtiyacın yaklaşık {r.energy.tdee} kcal, antrenman başına tahmini {r.energy.avgSessionKcal ?? '—'} kcal.
          </Text>

          {r.adaptationLog.length ? (
            <>
              <SectionHeader title="Program nasıl uyarlandı" />
              {r.adaptationLog.map((l) => (
                <Text key={l} variant="caption" tone="secondary" style={{ marginBottom: 3 }}>
                  • {l}
                </Text>
              ))}
            </>
          ) : null}
          <Notice kind="info" text={r.disclaimer} />
          {data?.final ? <Button label="Yeni program" variant="secondary" block onPress={() => router.push('/plan')} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
