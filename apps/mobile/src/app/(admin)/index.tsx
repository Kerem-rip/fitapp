// Yönetici: profesyonel başvuru listesi.
import type { AdminApplicationItem, ApplicationStatus } from '@fitapp/api-client';
import { Button, EmptyState, Icon, ListRow, Notice, Card, Screen, ScreenHeader, Segmented, Tag, useTheme } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText, signOut } from '@/auth/actions';
import { FIELD_LABELS } from '@/components/RegisterForm';

const STATUS_OPTIONS: { key: ApplicationStatus; label: string }[] = [
  { key: 'PENDING', label: 'Bekleyen' },
  { key: 'APPROVED', label: 'Onaylı' },
  { key: 'REJECTED', label: 'Reddedilen' },
];

const nameOf = (u: AdminApplicationItem['user']) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function AdminHome() {
  const router = useRouter();
  const { c } = useTheme();
  const [status, setStatus] = useState<ApplicationStatus>('PENDING');
  const [items, setItems] = useState<AdminApplicationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      api
        .adminApplications(status)
        .then((list) => !cancelled && setItems(list))
        .catch((e) => !cancelled && setError(errorText(e)));
      return () => {
        cancelled = true;
      };
    }, [status]),
  );

  return (
    <Screen>
      <ScreenHeader
        title="Başvurular"
        subtitle="Profesyonel hesap onayı"
        trailing={<Button label="Çıkış" variant="ghost" size="sm" onPress={() => void signOut()} />}
      />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="shield-outline" title="Moderasyon" subtitle="Şikâyetler ve itirazlar" onPress={() => router.push('/moderation')} last />
      </Card>
      <Segmented
        options={STATUS_OPTIONS}
        value={status}
        onChange={(s) => {
          setItems(null);
          setStatus(s);
        }}
      />
      {error ? <Notice kind="danger" text={error} /> : null}
      {items && items.length === 0 ? <EmptyState icon="checkmark-done" title="Bu listede başvuru yok" /> : null}
      {items && items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {items.map((item, i) => (
            <ListRow
              key={item.id}
              avatar={nameOf(item.user)}
              title={nameOf(item.user)}
              subtitle={`${FIELD_LABELS[item.field]} · ${dateOf(item.submittedAt)}${item.attemptNumber > 1 ? ` · ${item.attemptNumber}. başvuru` : ''}`}
              trailing={item.flagged ? <Tag label="Şüpheli" kind="danger" icon="flag" /> : <Icon name="chevron-forward" size={18} color={c.textMuted} />}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.id } })}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
