// Geçmişim: kullanıcının başladığı programlar, tamamladığı antrenmanlar, ölçüleri, öğün kayıtları ve kalori hedefi değişiklikleri.
import type { HistoryEntry } from '@fitapp/api-client';
import { EmptyState, Icon, Notice, Screen, ScreenHeader, Text, useTheme, type IconName } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

const ICONS: Record<string, IconName> = {
  PROGRAM_JOINED: 'flag-outline',
  PROGRAM_LEFT: 'exit-outline',
  PROGRAM_COMPLETED: 'trophy-outline',
  WORKOUT_DONE: 'barbell-outline',
  PLAN_PURCHASED: 'sparkles-outline',
  MEASUREMENT: 'resize-outline',
  MEALS: 'restaurant-outline',
  ROUTINE_ADDED: 'add-circle-outline',
  ROUTINE_DONE: 'checkmark-circle-outline',
  CALORIE_PROFILE: 'flame-outline',
  PREMIUM: 'star-outline',
};

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export function HistoryScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .history(80)
      .then((r) => setItems(r.items))
      .catch((e) => setError(errorText(e)));
  }, []);

  const groups = items ? [...new Set(items.map((i) => dayLabel(i.at)))] : [];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <ScreenHeader title="Geçmişim" subtitle="Başladıkların ve yaptıkların" onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {items && items.length === 0 ? <EmptyState icon="time-outline" title="Henüz geçmiş yok" text="Bir programa başladığında, antrenman yaptığında ya da ölçü girdiğinde burada görürsün." /> : null}
      {groups.map((g) => (
        <View key={g}>
          <Text variant="micro" tone="muted" style={{ marginTop: 14, marginBottom: 6, letterSpacing: 1 }}>
            {g.toLocaleUpperCase('tr')}
          </Text>
          <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 }}>
            {items!
              .filter((i) => dayLabel(i.at) === g)
              .map((i, idx, arr) => (
                <View key={`${i.at}-${i.title}-${idx}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: idx === arr.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                  <Icon name={ICONS[i.kind] ?? 'ellipse-outline'} size={22} color={accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{i.title}</Text>
                    {i.detail ? (
                      <Text variant="caption" tone="secondary">
                        {i.detail}
                      </Text>
                    ) : null}
                  </View>
                  <Text variant="micro" tone="muted">
                    {timeLabel(i.at)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}
