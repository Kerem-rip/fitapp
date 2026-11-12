// Mesaj kutusu. Uzmanlarda "Danışanlar" ve "Yeni mesajlar" ayrı durur, danışan mesajları kaybolmaz.
// Herkes uzmanlara doğrudan yazabilir (istek gerekmez).
import { Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, Segmented, Tag, Text } from '@fitapp/ui-mobile';
import { DemoBlock } from '@/components/DemoBlock';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { timeAgo } from '@/demo/dates';
import { useAccount, useDemoState } from '@/demo/hooks';
import { conversationsOf, isClientParty, lastMessage, otherParty, unreadCount } from '@/demo/selectors';

type Seg = 'clients' | 'new';

export function InboxScreen({ tabBarInset = false, showBack = false }: { tabBarInset?: boolean; showBack?: boolean }) {
  const router = useRouter();
  const account = useAccount();
  const state = useDemoState();
  const [seg, setSeg] = useState<Seg>('clients');

  const isPro = account?.roleKey === 'dietitian' || account?.roleKey === 'trainer';
  const all = useMemo(() => (account ? conversationsOf(state, account.id) : []), [state, account]);
  const list = useMemo(
    () =>
      isPro && account
        ? all.filter((c) => isClientParty(state, account.id, otherParty(c, account.id).id) === (seg === 'clients'))
        : all,
    [all, isPro, seg, state, account],
  );

  if (!account) return null;

  return (
    <Screen tabBarInset={tabBarInset}>
      <ScreenHeader title="Mesajlar" onBack={showBack ? () => router.back() : undefined} />
      <Notice kind="info" text="Mesajlaşma yakında gelecek. Şimdilik uzmanınla randevu ve plan üzerinden iletişimde kalabilirsin." />
      <DemoBlock>
      {isPro ? (
        <Segmented<Seg>
          options={[
            { key: 'clients', label: 'Danışanlar' },
            { key: 'new', label: 'Yeni mesajlar' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      ) : null}

      {list.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {list.map((conversation, i) => {
            const other = otherParty(conversation, account.id);
            const last = lastMessage(conversation);
            const unread = unreadCount(conversation, account.id);
            return (
              <ListRow
                key={conversation.id}
                avatar={other.name}
                title={other.name}
                subtitle={last ? (last.fromId === account.id ? `Sen: ${last.text}` : last.text) : 'Sohbeti başlat'}
                trailing={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {last ? (
                      <Text variant="micro" tone="muted">
                        {timeAgo(last.at)}
                      </Text>
                    ) : null}
                    {unread > 0 ? <Tag label={String(unread)} kind="accent" /> : null}
                  </View>
                }
                onPress={() => router.push(`/chat/${conversation.id}`)}
                last={i === list.length - 1}
              />
            );
          })}
        </Card>
      ) : (
        <EmptyState
          icon="chatbubbles-outline"
          title={isPro ? (seg === 'clients' ? 'Danışan mesajı yok' : 'Yeni mesaj yok') : 'Henüz mesajın yok'}
          text={isPro ? 'Herkes sana doğrudan yazabilir.' : 'Bir uzmanın profilinden "Mesaj at" ile sohbet başlatabilirsin.'}
        />
      )}
      </DemoBlock>
    </Screen>
  );
}
