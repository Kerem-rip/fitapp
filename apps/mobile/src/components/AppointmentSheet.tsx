// Randevu / ders ekleme penceresi.
import { BottomSheet, Button, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { addAppointment } from '@/demo/actions';
import { DAY_SHORT, dateKey, formatShort, weekdayIndex } from '@/demo/dates';
import { ChipRow } from './ChipRow';

const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

export function AppointmentSheet({
  visible,
  onClose,
  ownerId,
  clientNames,
  defaultClient,
  defaultDate,
  titleLabel = 'Randevu',
}: {
  visible: boolean;
  onClose: () => void;
  ownerId: string;
  clientNames: string[];
  defaultClient?: string;
  defaultDate?: string;
  titleLabel?: string;
}) {
  const [client, setClient] = useState(defaultClient ?? clientNames[0] ?? '');
  const [date, setDate] = useState(defaultDate ?? dateKey(0));
  const [time, setTime] = useState('10:00');
  const [kind, setKind] = useState<'online' | 'in_person'>('online');
  const [title, setTitle] = useState('Kontrol');

  useEffect(() => {
    if (visible) {
      setClient(defaultClient ?? clientNames[0] ?? '');
      setDate(defaultDate ?? dateKey(0));
    }
  }, [visible, defaultClient, defaultDate, clientNames]);

  const days = Array.from({ length: 7 }, (_, i) => dateKey(i));

  const save = () => {
    if (!client.trim()) {
      showToast('Kişi seç ya da yaz', 'warning');
      return;
    }
    addAppointment({ ownerId, title: title.trim() || titleLabel, clientName: client.trim(), date, time, kind });
    showToast(`${titleLabel} eklendi`);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${titleLabel} ekle`}>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Kişi
      </Text>
      <ChipRow wrap options={clientNames.map((n) => ({ key: n, label: n }))} selected={[client]} onToggle={setClient} />

      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Gün
      </Text>
      <ChipRow
        options={days.map((d) => ({ key: d, label: `${DAY_SHORT[weekdayIndex(d)]} ${formatShort(d)}` }))}
        selected={[date]}
        onToggle={setDate}
      />

      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Saat
      </Text>
      <ChipRow wrap options={TIMES.map((t) => ({ key: t, label: t }))} selected={[time]} onToggle={setTime} />

      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Görüşme şekli
      </Text>
      <ChipRow
        wrap
        options={[
          { key: 'online' as const, label: 'Online', icon: 'videocam-outline' as const },
          { key: 'in_person' as const, label: 'Yüz yüze', icon: 'people-outline' as const },
        ]}
        selected={[kind]}
        onToggle={setKind}
      />

      <TextField label="Başlık" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
      <View style={{ marginBottom: 8 }}>
        <Button label="Kaydet" size="lg" block onPress={save} />
      </View>
    </BottomSheet>
  );
}
