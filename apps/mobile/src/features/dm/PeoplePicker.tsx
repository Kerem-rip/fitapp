// Kişi seçici: takip ettiklerin listelenir, arama ile başkaları da bulunur. Tek ya da çoklu seçim.
import type { UserCard } from '@fitapp/api-client';
import { Card, Icon, SearchBar, Text, useTheme } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/auth-store';
import { PersonRow } from '@/components/social/PersonRow';

export function PeoplePicker({ selected, onToggle, exclude = [] }: { selected: string[]; onToggle: (person: UserCard) => void; exclude?: string[] }) {
  const { c, accent } = useTheme();
  const me = useAuth().me;
  const [q, setQ] = useState('');
  const [following, setFollowing] = useState<UserCard[]>([]);
  const [found, setFound] = useState<UserCard[] | null>(null);

  useEffect(() => {
    if (!me) return;
    api
      .following(me.id)
      .then((p) => setFollowing(p.items))
      .catch(() => setFollowing([]));
  }, [me]);

  useEffect(() => {
    const text = q.trim();
    if (!text) return;
    const timer = setTimeout(() => {
      api
        .search({ q: text, type: 'users' })
        .then((r) => setFound(r.users))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const list = (q.trim() ? (found ?? []) : following).filter((p) => !exclude.includes(p.id) && p.id !== me?.id);
  return (
    <View>
      <SearchBar value={q} onChangeText={setQ} placeholder="Kişi ara" />
      <View style={{ height: 10 }} />
      {list.length === 0 ? (
        <Text variant="caption" tone="muted">
          {q.trim() ? 'Kimse bulunamadı.' : 'Takip ettiğin kimse yok. Yukarıdan arayabilirsin.'}
        </Text>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {list.map((p, i) => {
            const on = selected.includes(p.id);
            return (
              <PersonRow
                key={p.id}
                person={p}
                linked={false}
                last={i === list.length - 1}
                trailing={
                  <Pressable onPress={() => onToggle(p)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${p.displayName} seç`} hitSlop={10}>
                    <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? accent : c.textMuted} />
                  </Pressable>
                }
              />
            );
          })}
        </Card>
      )}
    </View>
  );
}
