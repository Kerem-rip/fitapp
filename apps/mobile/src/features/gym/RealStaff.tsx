// Salon ekibi (gerçek veri): ekip listesi, kullanıcı adıyla davet, görev değiştirme ve ekipten çıkarma (sadece sahip).
// Davet edilen kişi kendi hesabından kabul eder; şifresini salon sahibi bilmez.
import type { GymStaffItem, GymStaffRole } from '@fitapp/api-client';
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { GYM_ROLE_LABELS } from './labels';

const ROLE_OPTIONS = [
  { key: 'TRAINER' as const, label: 'Eğitmen' },
  { key: 'RECEPTION' as const, label: 'Resepsiyon' },
];

export function RealStaffList({ canManage }: { canManage: boolean }) {
  const [staff, setStaff] = useState<GymStaffItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GymStaffItem | null>(null);

  const load = useCallback(async () => {
    try {
      setStaff(await api.gymStaff());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      showToast(message);
      setEditing(null);
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      {error ? <Notice kind="danger" text={error} /> : null}
      {staff && staff.length === 0 ? <EmptyState icon="people-outline" title="Henüz ekip yok" text="Davet sekmesinden eğitmen ya da resepsiyon görevlisi ekleyebilirsin." /> : null}
      {staff && staff.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {staff.map((s, i) => (
            <ListRow
              key={s.id}
              avatar={s.user.name}
              title={s.user.name}
              subtitle={`@${s.user.username} · ${GYM_ROLE_LABELS[s.role]}`}
              trailing={s.status === 'INVITED' ? <Tag label="Davet bekliyor" kind="warning" /> : <Tag label="Aktif" kind="success" />}
              onPress={canManage ? () => setEditing(s) : undefined}
              last={i === staff.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {canManage && staff && staff.length > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
          Görevini değiştirmek ya da ekipten çıkarmak için bir kişiye dokun.
        </Text>
      ) : null}

      <BottomSheet visible={editing !== null} onClose={() => setEditing(null)} title={editing?.user.name ?? ''}>
        {editing ? (
          <>
            {editing.status === 'ACTIVE' ? (
              <>
                <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
                  Görevi
                </Text>
                <ChipRow
                  wrap
                  options={ROLE_OPTIONS}
                  selected={[editing.role]}
                  onToggle={(role: GymStaffRole) => (role !== editing.role ? act(() => api.changeGymStaffRole(editing.id, role), 'Görev güncellendi') : undefined)}
                />
                <Notice
                  kind="info"
                  text="Eğitmen sadece üye adlarını ve üyelik durumunu görür. Resepsiyon telefonları, üyelik satışını ve ödeme kayıtlarını da görür."
                />
              </>
            ) : null}
            <Button
              label={editing.status === 'INVITED' ? 'Daveti geri al' : 'Ekipten çıkar'}
              variant="danger"
              block
              onPress={() => act(() => api.endGymStaff(editing.id), editing.status === 'INVITED' ? 'Davet geri alındı' : 'Ekipten çıkarıldı')}
              style={{ marginBottom: 8 }}
            />
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

export function RealStaffInvite({ onInvited }: { onInvited: () => void }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<GymStaffRole>('TRAINER');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    if (busy) return;
    const name = username.trim().replace(/^@/, '');
    if (name.length < 3) return setError('Davet edeceğin kişinin kullanıcı adını yaz.');
    setBusy(true);
    setError(null);
    try {
      await api.inviteGymStaff(name, role);
      showToast(`@${name} davet edildi`);
      setUsername('');
      onInvited();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@kullanici" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Görevi
      </Text>
      <ChipRow wrap options={ROLE_OPTIONS} selected={[role]} onToggle={setRole} />
      <Notice kind="info" text="Kişi uygulamada hesabı olan biri olmalı. Davet bildirimi gider; kendi hesabından kabul eder, şifresini sen bilmezsin. Bir kişi aynı anda tek bir salonun ekibinde olabilir." />
      <Button label={busy ? 'Gönderiliyor...' : 'Davet gönder'} size="lg" block icon="send-outline" disabled={busy} onPress={invite} />
    </>
  );
}
