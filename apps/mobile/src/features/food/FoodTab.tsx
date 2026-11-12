// Danışan dosyasının "Öğünler" sekmesi: danışanın kendi girdiği öğünler ve su, gün gün.
// Sadece danışanın paylaştığı kategoriler görünür; her bakış danışanın "verime kim baktı" kaydına düşer.
// Değerler tahminidir ve yorum içermez; değerlendirme uzmanındır.
import type { ClientFoodView, MealType } from '@fitapp/api-client';
import { Card, EmptyState, Notice, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { addDays, formatLong } from '@/demo/dates';
import { useToday } from '@/demo/hooks';

const MEAL_LABELS: Record<MealType, string> = { BREAKFAST: 'Kahvaltı', LUNCH: 'Öğle', SNACK: 'Ara öğün', DINNER: 'Akşam' };
const ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];

export function FoodTab({ clientId }: { clientId: string }) {
  const today = useToday();
  const [range, setRange] = useState<'7' | '14'>('7');
  const [view, setView] = useState<ClientFoodView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await api.clientFood(clientId, addDays(today, -(Number(range) - 1)), today));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [clientId, range, today]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (error) return <Notice kind="danger" text={error} />;
  if (!view) return null;
  if (!view.shared.meals && !view.shared.water) {
    return <EmptyState icon="lock-closed-outline" title="Öğün ve su kayıtları paylaşılmıyor" text="Danışan paylaşımı açarsa kayıtları burada görünür." />;
  }

  const logged = view.days.filter((d) => d.meals.length > 0).length;

  return (
    <>
      <ChipRow
        options={[
          { key: '7' as const, label: 'Son 7 gün' },
          { key: '14' as const, label: 'Son 14 gün' },
        ]}
        selected={[range]}
        onToggle={setRange}
      />
      {view.shared.meals ? (
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
          {view.days.length} günün {logged} gününde öğün kaydı var.
        </Text>
      ) : (
        <Notice kind="info" text="Öğün kayıtları paylaşılmıyor; sadece su görünüyor." />
      )}
      {!view.shared.water && view.shared.meals ? (
        <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>
          Su takibi paylaşılmıyor.
        </Text>
      ) : null}

      {view.days.map((d) => (
        <Card key={d.date} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text variant="heading">{formatLong(d.date)}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {view.shared.meals ? <Tag label={`${d.totals.kcal} kcal`} kind={d.meals.length ? 'accent' : 'neutral'} /> : null}
              {d.waterMl !== null ? <Tag label={`${(d.waterMl / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} L su`} kind="info" /> : null}
            </View>
          </View>
          {view.shared.meals && d.meals.length === 0 ? (
            <Text variant="caption" tone="muted">
              Öğün kaydı yok.
            </Text>
          ) : null}
          {ORDER.map((type) => {
            const items = d.meals.filter((m) => m.mealType === type);
            if (items.length === 0) return null;
            return (
              <View key={type} style={{ marginTop: 4 }}>
                <Text variant="caption" tone="secondary" style={{ fontWeight: '700' }}>
                  {MEAL_LABELS[type]}
                </Text>
                {items.map((m) => (
                  <Text key={m.id} variant="caption">
                    • {m.name} · {m.servings.toLocaleString('tr-TR')}× {m.portion} · {Math.round(m.kcal)} kcal
                  </Text>
                ))}
              </View>
            );
          })}
          {view.shared.meals && d.meals.length > 0 ? (
            <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
              Protein {d.totals.proteinG.toLocaleString('tr-TR')} g · Karb. {d.totals.carbsG.toLocaleString('tr-TR')} g · Yağ {d.totals.fatG.toLocaleString('tr-TR')} g
            </Text>
          ) : null}
        </Card>
      ))}
      <Text variant="micro" tone="muted">
        Değerler danışanın girdiği kayıtlardan hesaplanan tahminlerdir; yorum içermez. Kayıt olmaması yemediği anlamına gelmez.
      </Text>
    </>
  );
}
