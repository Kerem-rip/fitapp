// Salon üyesi seçici: ada göre arar, seçileni geri verir. Ders oluşturma ve derse üye yazmada kullanılır.
import type { GymMemberListItem } from '@fitapp/api-client';
import { ListRow, Notice, SearchBar, Tag } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { membershipTag } from './labels';

export function MemberPicker({ onPick, exclude = [] }: { onPick: (m: GymMemberListItem) => void; exclude?: string[] }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<GymMemberListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .gymMembers({ q: query.trim() || undefined })
        .then((list) => {
          setMembers(list);
          setError(null);
        })
        .catch((e) => setError(errorText(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const list = members.filter((m) => !exclude.includes(m.id)).slice(0, 8);
  return (
    <>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Üye ara" />
      {error ? <Notice kind="warning" text={error} /> : null}
      {list.map((m, i) => {
        const tag = membershipTag(m.current);
        return (
          <ListRow
            key={m.id}
            avatar={m.fullName}
            title={m.fullName}
            subtitle={m.current ? `${m.current.planName}${m.current.sessionsLeft !== null ? ` · ${m.current.sessionsLeft} ders hakkı` : ''}` : undefined}
            trailing={<Tag label={tag.label} kind={tag.kind} />}
            onPress={() => onPick(m)}
            last={i === list.length - 1}
          />
        );
      })}
    </>
  );
}
