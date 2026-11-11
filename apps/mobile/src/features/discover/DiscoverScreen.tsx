// Keşfet: doğrulanmış diyetisyen, eğitmen ve spor salonları. Ücretsiz kullanıcılar da uzmanlara ulaşabilir.
import { Avatar, Button, Card, Notice, Screen, ScreenHeader, SearchBar, Stars, Tag, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { requestParentalApproval } from '@/demo/actions';
import { useAccount, useShared, useUserData } from '@/demo/hooks';
import { MODE_LABELS } from '@/demo/labels';
import { SEED_PROS } from '@/demo/seed';
import type { ProKind } from '@/demo/types';

type Filter = 'all' | ProKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'dietitian', label: 'Diyetisyen' },
  { key: 'trainer', label: 'Eğitmen' },
  { key: 'gym', label: 'Salon' },
];

export function DiscoverScreen() {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  const shared = useShared();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const teen = account?.roleKey === 'teen';

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return SEED_PROS.filter((p) => filter === 'all' || p.kind === filter).filter(
      (p) =>
        !q ||
        p.name.toLocaleLowerCase('tr-TR').includes(q) ||
        p.city.toLocaleLowerCase('tr-TR').includes(q) ||
        p.specialties.some((s) => s.toLocaleLowerCase('tr-TR').includes(q)),
    );
  }, [query, filter]);

  const ratingOf = (proId: string, fallback: number) => {
    const reviews = shared.reviews.filter((r) => r.proId === proId);
    if (reviews.length === 0) return fallback;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Keşfet" subtitle="Doğrulanmış uzmanlar ve salonlar" />

      {teen ? (
        <Notice
          kind="warning"
          title="Veli onayı gerekir"
          text={
            data.parentalApproval === 'approved'
              ? 'Veli onayın tamam. Uzmanlara mesaj atabilirsin.'
              : data.parentalApproval === 'requested'
                ? 'Veli onayı bekleniyor. Onaylanınca uzmanlara mesaj atabilirsin.'
                : 'Uzmanlara ulaşmak için velinin onayı gerekir.'
          }
        />
      ) : null}
      {teen && data.parentalApproval === 'none' && account ? (
        <Button label="Veli onayı iste" block variant="secondary" onPress={() => requestParentalApproval(account.id)} style={{ marginBottom: 12 }} />
      ) : null}

      <SearchBar value={query} onChangeText={setQuery} placeholder="İsim, şehir veya uzmanlık ara" />
      <ChipRow options={FILTERS} selected={[filter]} onToggle={setFilter} />

      {list.map((pro) => (
        <Card key={pro.id} onPress={() => router.push(`/professional/${pro.id}`)}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Avatar name={pro.name} size={56} story />
            <View style={{ flex: 1, marginLeft: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text variant="subheading" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {pro.name}
                </Text>
                <Tag label="Doğrulanmış" kind="success" icon="checkmark-circle" />
              </View>
              <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                {pro.title} · {pro.city}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Stars value={ratingOf(pro.id, pro.rating)} size={14} />
                <Text variant="caption" tone="secondary">
                  {ratingOf(pro.id, pro.rating).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · {pro.clientCount} {pro.kind === 'gym' ? 'üye' : 'danışan'}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {pro.specialties.slice(0, 3).map((s) => (
              <Tag key={s} label={s} kind="accent" />
            ))}
            <Tag label={MODE_LABELS[pro.mode]} kind="neutral" />
          </View>
        </Card>
      ))}
      {list.length === 0 ? (
        <Pressable onPress={() => { setQuery(''); setFilter('all'); }}>
          <Text variant="body" tone="secondary" align="center" style={{ paddingVertical: 32 }}>
            Sonuç bulunamadı. Filtreleri temizlemek için dokun.
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
