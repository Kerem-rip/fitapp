// Salon üyeleri (gerçek veri). Üyeler uygulama hesabı olmayan salon kayıtlarıdır; sağlık verisi tutulmaz.
// Telefon ve borç sadece sahip ve resepsiyona gelir; eğitmen sadece adı ve üyelik durumunu görür.
import type { GymMemberListItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, SearchBar, Segmented, showToast, Tag, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatTL, membershipTag } from './labels';

type Status = 'ACTIVE' | 'ARCHIVED';

export function RealMembers({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('ACTIVE');
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<GymMemberListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setMembers(await api.gymMembers({ q: query.trim() || undefined, status }));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [query, status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // Aramada her tuşta değil, yazmayı bırakınca sorgula
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <Segmented<Status>
        options={[
          { key: 'ACTIVE', label: 'Aktif' },
          { key: 'ARCHIVED', label: 'Arşiv' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Üye ara" />
      {error ? <Notice kind="danger" text={error} /> : null}
      {members && members.length === 0 ? (
        <EmptyState icon="id-card-outline" title={query ? 'Eşleşen üye yok' : status === 'ACTIVE' ? 'Henüz üye yok' : 'Arşivde üye yok'} />
      ) : null}
      {members && members.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {members.map((m, i) => {
            const tag = membershipTag(m.current);
            return (
              <ListRow
                key={m.id}
                avatar={m.fullName}
                title={m.fullName}
                subtitle={[m.current?.planName, m.phone].filter(Boolean).join(' · ') || undefined}
                trailing={
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {m.balanceKurus && m.balanceKurus > 0 ? <Tag label={`Kalan ${formatTL(m.balanceKurus)}`} kind="warning" /> : null}
                    <Tag label={tag.label} kind={tag.kind} />
                  </View>
                }
                onPress={() => router.push(`/gym-member/${m.id}`)}
                last={i === members.length - 1}
              />
            );
          })}
        </Card>
      ) : null}
      {canManage ? <Button label="Üye ekle" icon="person-add-outline" size="lg" block onPress={() => setAdding(true)} style={{ marginTop: 12 }} /> : null}
      <Notice kind="success" text="Salon kaydında sağlık verisi tutulmaz. Üyenin sağlık verisini yalnızca üye kendi hesabından paylaşırsa görürsün." />

      {adding ? (
        <AddMemberSheet
          onClose={() => setAdding(false)}
          onAdded={(id) => {
            setAdding(false);
            showToast('Üye eklendi');
            router.push(`/gym-member/${id}`);
          }}
        />
      ) : null}
    </>
  );
}

function AddMemberSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (fullName.trim().length < 2) return setError('Ad soyad yaz.');
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.addGymMember({ fullName: fullName.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined });
      onAdded(id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Üye ekle">
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Ad soyad" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={80} />
      <TextField label="Telefon (isteğe bağlı)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={300} hint="Sağlık bilgisi yazma; salon kaydı sağlık verisi için değildir." />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
