// Haftalık vardiya şablonu (gerçek veri). Sahip düzenler; ekip görür.
import type { GymShiftRow } from '@fitapp/api-client';
import { BottomSheet, Card, ListRow, Notice, showToast, Tag, Text, TextField, Button } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { DAY_SHORT } from '@/demo/dates';
import { WEEKDAY_FULL } from '@/demo/labels';
import { GYM_ROLE_LABELS } from './labels';
import { shiftLabel, useGymTeam } from './useGymTeam';

const PRESETS = [
  { start: '08:00', end: '16:00' },
  { start: '09:00', end: '17:00' },
  { start: '12:00', end: '20:00' },
  { start: '16:00', end: '23:00' },
];

export function RealShifts({ manage, todayIndex }: { manage: boolean; todayIndex: number }) {
  const { team, reload } = useGymTeam();
  const [day, setDay] = useState(todayIndex);
  const [editing, setEditing] = useState<GymShiftRow | null>(null);

  const save = async (row: GymShiftRow, shift: { start: string; end: string } | null) => {
    try {
      await api.setGymShift(row.user.id, day, shift);
      showToast('Vardiya güncellendi');
      setEditing(null);
      await reload();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <>
      <ChipRow options={DAY_SHORT.map((d, i) => ({ key: String(i), label: d }))} selected={[String(day)]} onToggle={(k) => setDay(Number(k))} />
      <Text variant="heading" style={{ marginBottom: 8 }}>
        {WEEKDAY_FULL[day]} vardiyası
      </Text>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {team.map((t, i) => (
          <ListRow
            key={t.user.id}
            avatar={t.user.name}
            title={t.user.name}
            subtitle={GYM_ROLE_LABELS[t.role]}
            trailing={<Tag label={shiftLabel(t.days[day])} kind={t.days[day] ? 'accent' : 'neutral'} icon="time-outline" />}
            onPress={manage ? () => setEditing(t) : undefined}
            last={i === team.length - 1}
          />
        ))}
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
        {manage ? 'Düzenlemek için bir kişiye dokun. ' : ''}Haftalık şablondur; her hafta aynı tekrarlanır.
      </Text>

      {editing ? <ShiftSheet row={editing} day={day} onClose={() => setEditing(null)} onSave={(s) => save(editing, s)} /> : null}
    </>
  );
}

function ShiftSheet({ row, day, onClose, onSave }: { row: GymShiftRow; day: number; onClose: () => void; onSave: (s: { start: string; end: string } | null) => void }) {
  const current = row.days[day];
  const [start, setStart] = useState(current?.start ?? '');
  const [end, setEnd] = useState(current?.end ?? '');
  const [error, setError] = useState<string | null>(null);
  const valid = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  return (
    <BottomSheet visible onClose={onClose} title={`${row.user.name} · ${WEEKDAY_FULL[day]}`}>
      {error ? <Notice kind="warning" text={error} /> : null}
      {PRESETS.map((p) => (
        <ListRow
          key={p.start}
          icon="time-outline"
          title={shiftLabel(p)}
          trailing={current?.start === p.start && current.end === p.end ? <Tag label="Seçili" kind="accent" /> : undefined}
          onPress={() => onSave(p)}
        />
      ))}
      <ListRow icon="moon-outline" title="İzinli" trailing={!current ? <Tag label="Seçili" kind="accent" /> : undefined} onPress={() => onSave(null)} last />
      <Text variant="caption" tone="secondary" style={{ marginTop: 12, marginBottom: 8, fontWeight: '600' }}>
        Başka saat
      </Text>
      <TextField label="Başlangıç" value={start} onChangeText={setStart} placeholder="10:00" keyboardType="numbers-and-punctuation" />
      <TextField label="Bitiş" value={end} onChangeText={setEnd} placeholder="18:00" keyboardType="numbers-and-punctuation" />
      <Button
        label="Kaydet"
        block
        onPress={() => (valid(start.trim()) && valid(end.trim()) && end.trim() > start.trim() ? onSave({ start: start.trim(), end: end.trim() }) : setError('Saatleri SS:DD biçiminde yaz; bitiş başlangıçtan sonra olmalı.'))}
        style={{ marginBottom: 8 }}
      />
    </BottomSheet>
  );
}
