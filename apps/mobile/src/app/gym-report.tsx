// Tahsilat raporu (salon sahibi): seçilen dönemde kaydedilen ödemeler, ödeme türüne ve günlere göre.
// Ödemeler sadece kayıttır; iptal edilen kayıtlar toplamlara katılmaz.
import type { GymPaymentsReport, PaymentMethod } from '@fitapp/api-client';
import { Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { addDays, weekdayIndex } from '@/demo/dates';
import { useToday } from '@/demo/hooks';
import { formatDate, formatTL, METHOD_LABELS } from '@/features/gym/labels';

type Range = 'today' | 'week' | 'month' | 'last30';

function rangeOf(range: Range, today: string): { from: string; to: string } {
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') return { from: addDays(today, -weekdayIndex(today)), to: today };
  if (range === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: addDays(today, -29), to: today };
}

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

export default function GymReportScreen() {
  const router = useRouter();
  const today = useToday();
  const [range, setRange] = useState<Range>('week');
  const [report, setReport] = useState<GymPaymentsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = rangeOf(range, today);
    api
      .gymPaymentsReport(from, to)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [range, today]);

  // Sadece iptal edilmiş kaydı olan günler listede görünmez
  const days = report?.days.filter((d) => d.count > 0) ?? [];

  return (
    <Screen>
      <ScreenHeader title="Tahsilat raporu" subtitle="Kaydedilen ödemeler" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ChipRow
        options={[
          { key: 'today' as const, label: 'Bugün' },
          { key: 'week' as const, label: 'Bu hafta' },
          { key: 'month' as const, label: 'Bu ay' },
          { key: 'last30' as const, label: 'Son 30 gün' },
        ]}
        selected={[range]}
        onToggle={setRange}
      />
      {error ? <Notice kind="danger" text={error} /> : null}

      {report ? (
        <>
          <Card variant="accent" style={{ marginBottom: 12 }}>
            <Text variant="micro" tone="onAccent" style={{ opacity: 0.9 }}>
              {report.from === report.to ? formatDate(report.from).toLocaleUpperCase('tr-TR') : `${formatDate(report.from)} – ${formatDate(report.to)}`.toLocaleUpperCase('tr-TR')}
            </Text>
            <Text variant="title" tone="onAccent" style={{ marginTop: 4 }}>
              {formatTL(report.total.totalKurus)}
            </Text>
            <Text variant="body" tone="onAccent" style={{ opacity: 0.95 }}>
              {report.total.count} ödeme kaydı
            </Text>
          </Card>

          <SectionHeader title="Ödeme türüne göre" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {METHODS.map((m, i) => (
              <ListRow
                key={m}
                icon={m === 'CASH' ? 'cash-outline' : m === 'CARD' ? 'card-outline' : m === 'TRANSFER' ? 'swap-horizontal-outline' : 'ellipsis-horizontal'}
                title={METHOD_LABELS[m]}
                trailing={<Text variant="bodyStrong">{formatTL(report.total.byMethod[m])}</Text>}
                last={i === METHODS.length - 1}
              />
            ))}
          </Card>

          <SectionHeader title="Günlere göre" />
          {days.length === 0 ? <Notice kind="info" text="Bu dönemde ödeme kaydı yok." /> : null}
          {days.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {[...days].reverse().map((d, i, list) => (
                <ListRow
                  key={d.day}
                  icon="calendar-outline"
                  title={formatDate(d.day)}
                  subtitle={`${d.count} ödeme`}
                  trailing={<Text variant="bodyStrong">{formatTL(d.totalKurus)}</Text>}
                  last={i === list.length - 1}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Text variant="micro" tone="muted" style={{ marginTop: 10 }}>
        Ödemeler sadece kayıttır; uygulama üzerinden para alınmaz. İptal edilen kayıtlar toplamlara katılmaz. Günler Türkiye saatine göredir.
      </Text>
    </Screen>
  );
}
