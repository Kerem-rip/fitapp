// Antrenman kaydı penceresi: programın bir gününü (setler, tekrar, kg), eforu ve ağrı bildirimini girer.
// Danışan kendi antrenmanını, antrenör yüz yüze seansı danışan adına girer.
import type { ProgramDay, WorkoutLogInput } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Notice, SwitchRow, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';

type SetRow = { reps: string; kg: string };

const firstNumber = (text: string | undefined) => {
  const m = /(\d+(?:[.,]\d+)?)/.exec(text ?? '');
  return m ? m[1]!.replace(',', '.') : '';
};
const isoDay = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const RPE = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export function WorkoutLogSheet({
  day,
  onClose,
  onSubmit,
  title = 'Antrenmanı kaydet',
}: {
  day: ProgramDay | null;
  onClose: () => void;
  onSubmit: (input: WorkoutLogInput) => Promise<void>;
  title?: string;
}) {
  const [rows, setRows] = useState<SetRow[][]>([]);
  const [date, setDate] = useState<'0' | '-1'>('0');
  const [rpe, setRpe] = useState<string | null>(null);
  const [pain, setPain] = useState(false);
  const [painNote, setPainNote] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!day) return;
    setRows(day.exercises.map((e) => Array.from({ length: e.sets }, () => ({ reps: firstNumber(e.reps), kg: e.load?.includes('kg') ? firstNumber(e.load) : '' }))));
    setDate('0');
    setRpe(null);
    setPain(false);
    setPainNote('');
    setNote('');
    setError(null);
  }, [day]);

  if (!day) return null;

  const setCell = (ei: number, si: number, key: keyof SetRow, value: string) =>
    setRows((cur) => cur.map((sets, i) => (i === ei ? sets.map((s, j) => (j === si ? { ...s, [key]: value } : s)) : sets)));

  const submit = async () => {
    if (busy) return;
    const entries = day.exercises.flatMap((e, ei) => {
      const sets = (rows[ei] ?? [])
        .filter((s) => s.reps.trim())
        .map((s) => ({ reps: Math.round(Number(s.reps.replace(',', '.'))), ...(s.kg.trim() ? { loadKg: Number(s.kg.replace(',', '.')) } : {}) }));
      return sets.length ? [{ exerciseId: e.id, name: e.name, sets }] : [];
    });
    if (entries.length === 0) return setError('En az bir set için tekrar yaz.');
    if (entries.some((e) => e.sets.some((s) => !Number.isFinite(s.reps) || (s.loadKg !== undefined && !Number.isFinite(s.loadKg))))) {
      return setError('Tekrar ve kg sayı olmalı.');
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        date: isoDay(Number(date)),
        dayId: day.id,
        entries,
        ...(rpe ? { rpe: Number(rpe) } : {}),
        pain,
        ...(pain && painNote.trim() ? { painNote: painNote.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title={title}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <ChipRow
        options={[
          { key: '0', label: 'Bugün' },
          { key: '-1', label: 'Dün' },
        ]}
        selected={[date]}
        onToggle={setDate}
      />
      {day.exercises.map((e, ei) => (
        <Card key={e.id} variant="outline" style={{ marginBottom: 8 }}>
          <Text variant="bodyStrong">{e.name}</Text>
          <Text variant="caption" tone="muted" style={{ marginBottom: 6 }}>
            Hedef: {e.sets} × {e.reps}
            {e.load ? ` · ${e.load}` : ''}
          </Text>
          {(rows[ei] ?? []).map((s, si) => (
            <View key={si} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text variant="caption" tone="secondary" style={{ width: 44 }}>
                {si + 1}. set
              </Text>
              <View style={{ flex: 1 }}>
                <TextField label="Tekrar" value={s.reps} onChangeText={(t) => setCell(ei, si, 'reps', t)} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="kg" value={s.kg} onChangeText={(t) => setCell(ei, si, 'kg', t)} keyboardType="decimal-pad" />
              </View>
            </View>
          ))}
        </Card>
      ))}
      <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
        Ne kadar zorlandın? (1 çok kolay · 10 en zor, isteğe bağlı)
      </Text>
      <ChipRow wrap options={RPE.map((r) => ({ key: r, label: r }))} selected={rpe ? [rpe] : []} onToggle={(r) => setRpe((cur) => (cur === r ? null : r))} />
      <SwitchRow title="Ağrı veya rahatsızlık hissettim" description="İşaretlersen antrenörün hemen görür." value={pain} onChange={setPain} last />
      {pain ? <TextField label="Nerede, ne zaman?" value={painNote} onChangeText={setPainNote} maxLength={300} /> : null}
      <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={500} />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
