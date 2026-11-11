// Özel ders formu (üye, eğitmen, saat seçimi). Pencerenin içinde kullanılır.
import { Button, Text } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { ChipRow } from '@/components/ChipRow';
import { addLesson } from '@/demo/actions';
import { useGym } from './useGym';

const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

export function LessonForm({ gymId, date, onDone }: { gymId: string; date: string; onDone: () => void }) {
  const { members, staff } = useGym();
  const trainers = staff.filter((s) => s.role === 'trainer');
  const [member, setMember] = useState(members[0]?.name ?? '');
  const [trainer, setTrainer] = useState(trainers[0]?.id ?? '');
  const [time, setTime] = useState('10:00');

  const save = () => {
    if (!member || !trainer) return;
    addLesson({ gymId, title: 'Özel ders', date, time, trainerId: trainer, kind: 'private', memberName: member });
    onDone();
  };

  return (
    <>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Üye
      </Text>
      <ChipRow wrap options={members.map((m) => ({ key: m.name, label: m.name }))} selected={[member]} onToggle={setMember} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Eğitmen
      </Text>
      <ChipRow wrap options={trainers.map((t) => ({ key: t.id, label: t.name }))} selected={[trainer]} onToggle={setTrainer} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Saat
      </Text>
      <ChipRow wrap options={TIMES.map((t) => ({ key: t, label: t }))} selected={[time]} onToggle={setTime} />
      <Button label="Kaydet" size="lg" block onPress={save} style={{ marginBottom: 8 }} />
    </>
  );
}
