// Ajanda (diyetisyen ve eğitmen): haftalık görünüm, randevu ekleme ve silme.
import { Button, Card, EmptyState, IconButton, ListRow, Screen, ScreenHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useMemo, useState } from 'react';
import { AppointmentSheet } from '@/components/AppointmentSheet';
import { WeekStrip } from '@/components/WeekStrip';
import { removeAppointment } from '@/demo/actions';
import { formatLong } from '@/demo/dates';
import { useAccount, useDemoState, useToday } from '@/demo/hooks';
import { activeLinksOf, clientView } from '@/demo/selectors';
import { DEMO_TOOLS } from '@/config/features';
import { RealAgenda } from './RealAgenda';

export function AgendaScreen() {
  const account = useAccount();
  const state = useDemoState();
  const today = useToday();
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState(false);

  const mine = useMemo(
    () => state.shared.appointments.filter((a) => a.ownerId === account?.id),
    [state.shared.appointments, account?.id],
  );
  const day = useMemo(() => mine.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time)), [mine, date]);
  const marked = useMemo(() => mine.map((a) => a.date), [mine]);
  const clientNames = useMemo(
    () => (account ? activeLinksOf(state, account.id).flatMap((l) => clientView(state, l.clientId)?.name ?? []) : []),
    [state, account],
  );

  if (!account) return null;
  const isTrainer = account.roleKey === 'trainer';

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Ajanda" subtitle={formatLong(date)} />
      <RealAgenda demoNote={DEMO_TOOLS} />
      <WeekStrip selected={date} onSelect={setDate} marked={marked} />

      {day.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {day.map((a, i) => (
            <ListRow
              key={a.id}
              icon={a.kind === 'online' ? 'videocam-outline' : 'people-outline'}
              title={`${a.time} · ${a.clientName}`}
              subtitle={a.title}
              trailing={
                <>
                  <Tag label={a.kind === 'online' ? 'Online' : 'Yüz yüze'} kind={a.kind === 'online' ? 'info' : 'accent'} />
                  <IconButton icon="trash-outline" label="Randevuyu sil" size={34} onPress={() => removeAppointment(a.id)} />
                </>
              }
              last={i === day.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState icon="calendar-clear-outline" title="Bu gün için kayıt yok" text="Yeni bir randevu ekleyebilirsin." />
      )}

      <Button label={isTrainer ? 'Ders ekle' : 'Randevu ekle'} icon="add" size="lg" block onPress={() => setOpen(true)} style={{ marginTop: 8 }} />
      <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
        Danışanın randevuyu uygulamadan almasına izin veren online takvim sonraki sürümde gelecek.
      </Text>

      <AppointmentSheet visible={open} onClose={() => setOpen(false)} ownerId={account.id} clientNames={clientNames} defaultDate={date} titleLabel={isTrainer ? 'Ders' : 'Randevu'} />
    </Screen>
  );
}
