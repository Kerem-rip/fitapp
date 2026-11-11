// Danışan listesi (diyetisyen ve bağımsız eğitmen).
import { Card, EmptyState, ListRow, Screen, ScreenHeader, SearchBar, Tag } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ChipRow } from '@/components/ChipRow';
import { useAccount, useShared } from '@/demo/hooks';
import { GOAL_LABELS } from '@/demo/labels';
import { useClients } from './useClients';

type Filter = 'all' | 'attention' | 'new';

export function ClientsScreen() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const clients = useClients();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const isDietitian = account?.roleKey === 'dietitian';

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return clients
      .filter((c) => (filter === 'attention' ? c.needsAttention || (isDietitian && c.allergyMissing) : filter === 'new' ? c.isNew : true))
      .filter((c) => !q || c.view.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [clients, filter, query, isDietitian]);

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Danışanlar" subtitle={`${clients.length} aktif danışan`} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Danışan ara" />
      <ChipRow
        options={[
          { key: 'all' as const, label: 'Tümü' },
          { key: 'attention' as const, label: 'Dikkat' },
          { key: 'new' as const, label: 'Yeni' },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />

      {list.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {list.map((c, i) => {
            const weights = c.view.weights;
            const first = weights[0]?.kg ?? c.view.weightKg;
            const last = weights[weights.length - 1]?.kg ?? c.view.weightKg;
            const assigned = shared.assignments.find((a) => a.clientId === c.view.id && a.trainerId === account?.id);
            const programTitle = assigned ? shared.programs.find((p) => p.id === assigned.programId)?.title : undefined;
            const subtitle = isDietitian
              ? `${first.toLocaleString('tr-TR')} → ${last.toLocaleString('tr-TR')} kg · hedef ${c.view.targetWeightKg.toLocaleString('tr-TR')} kg`
              : `${GOAL_LABELS[c.view.goal]} · ${programTitle ?? 'Program bekliyor'}`;
            const tag =
              c.needsAttention || (isDietitian && c.allergyMissing) ? (
                <Tag label={c.allergyMissing && isDietitian && !c.needsAttention ? 'Alerji eksik' : 'Dikkat'} kind="warning" />
              ) : c.isNew ? (
                <Tag label="Yeni" kind="accent" />
              ) : (
                <Tag label="Yolunda" kind="success" />
              );
            return (
              <ListRow
                key={c.link.id}
                avatar={c.view.name}
                title={c.view.name}
                subtitle={subtitle}
                trailing={tag}
                onPress={() => router.push(`/client/${c.view.id}`)}
                last={i === list.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <EmptyState icon="people-outline" title="Danışan bulunamadı" text="Filtreyi değiştirmeyi dene." />
      )}
    </Screen>
  );
}
