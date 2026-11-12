// Danışan listesi (diyetisyen ve bağımsız eğitmen): sunucudaki aktif danışanlar ve inceleme durumları.
// Sağlık verisi bu listede gelmez; dosya açıldığında erişim izinle ve denetim kaydıyla sunucuda sınırlanır.
// Örnek danışanlar sadece demo kutusunda görünür.
import type { ProfessionalRelationshipItem, ReviewOverviewItem } from '@fitapp/api-client';
import { Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SearchBar, Tag } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { DemoBlock } from '@/components/DemoBlock';
import { useAccount, useShared } from '@/demo/hooks';
import { GOAL_LABELS } from '@/demo/labels';
import { nameOf } from '@/features/sharing/labels';
import { useClients } from './useClients';

type Filter = 'all' | 'attention';

export function ClientsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ProfessionalRelationshipItem[] | null>(null);
  const [overview, setOverview] = useState<ReviewOverviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      api
        .relationshipsAsProfessional('ACTIVE')
        .then((list) => {
          setItems(list);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
      api
        .reviewOverview()
        .then(setOverview)
        .catch(() => setOverview([]));
    }, []),
  );

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return (items ?? [])
      .filter((r) => !q || nameOf(r.client).toLocaleLowerCase('tr-TR').includes(q) || r.client.username.includes(q))
      .filter((r) => {
        if (filter === 'all') return true;
        const o = overview.find((x) => x.client.id === r.client.id);
        return o !== undefined && o.red + o.yellow + o.openTasks > 0;
      });
  }, [items, overview, query, filter]);

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Danışanlar" subtitle={items ? `${items.length} aktif danışan` : 'Yükleniyor'} />
      {error ? <Notice kind="danger" text={error} /> : null}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Danışan ara" />
      <ChipRow
        options={[
          { key: 'all' as const, label: 'Tümü' },
          { key: 'attention' as const, label: 'İnceleme bekleyen' },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />

      {items && list.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={items.length === 0 ? 'Henüz danışanın yok' : 'Eşleşen danışan yok'}
          text={items.length === 0 ? 'Kullanıcı adıyla teklif gönderebilirsin.' : 'Aramayı ya da filtreyi değiştir.'}
        />
      ) : null}
      {list.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {list.map((r, i) => {
            const o = overview.find((x) => x.client.id === r.client.id);
            const pending = o ? o.red + o.yellow + o.openTasks : 0;
            return (
              <ListRow
                key={r.id}
                avatar={nameOf(r.client)}
                title={nameOf(r.client)}
                subtitle={r.sharingExpired ? 'Paylaşım süresi doldu' : r.sharedData.length === 0 ? 'Henüz veri paylaşmıyor' : `@${r.client.username}`}
                trailing={
                  o && o.red > 0 ? (
                    <Tag label={`${o.red} kırmızı`} kind="danger" />
                  ) : pending > 0 ? (
                    <Tag label="İnceleme bekliyor" kind="warning" />
                  ) : (
                    <Tag label="Güncel" kind="success" />
                  )
                }
                onPress={() => router.push(`/client-file/${r.client.id}`)}
                last={i === list.length - 1}
              />
            );
          })}
        </Card>
      ) : null}
      <Button label="Danışan ekle ve teklifler" icon="person-add-outline" variant="secondary" block onPress={() => router.push('/my-clients')} style={{ marginTop: 12 }} />

      <DemoBlock>
        <DemoClients />
      </DemoBlock>
    </Screen>
  );
}

// Örnek danışan listesi (demo verisi)
function DemoClients() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const clients = useClients();
  const isDietitian = account?.roleKey === 'dietitian';

  if (clients.length === 0) return <EmptyState icon="people-outline" title="Örnek danışan yok" />;
  return (
    <Card padded={false} style={{ paddingHorizontal: 16 }}>
      {clients.map((c, i) => {
        const weights = c.view.weights;
        const first = weights[0]?.kg ?? c.view.weightKg;
        const last = weights[weights.length - 1]?.kg ?? c.view.weightKg;
        const assigned = shared.assignments.find((a) => a.clientId === c.view.id && a.trainerId === account?.id);
        const programTitle = assigned ? shared.programs.find((p) => p.id === assigned.programId)?.title : undefined;
        const subtitle = isDietitian
          ? `${first.toLocaleString('tr-TR')} → ${last.toLocaleString('tr-TR')} kg · hedef ${c.view.targetWeightKg.toLocaleString('tr-TR')} kg`
          : `${GOAL_LABELS[c.view.goal]} · ${programTitle ?? 'Program bekliyor'}`;
        return (
          <ListRow
            key={c.link.id}
            avatar={c.view.name}
            title={c.view.name}
            subtitle={subtitle}
            trailing={<Tag label="Örnek" kind="neutral" />}
            onPress={() => router.push(`/client/${c.view.id}`)}
            last={i === clients.length - 1}
          />
        );
      })}
    </Card>
  );
}
