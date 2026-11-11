// Program egzersizi ekleme/düzenleme. Antrenör örnek katalogdan başlayabilir; set, tekrar ve yük onun kararıdır.
import type { ProgramExercise } from '@fitapp/api-client';
import { BottomSheet, Button, ListRow, Notice, Stepper, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { EXERCISES } from '@/demo/content';
import { localId } from '@/features/plans/helpers';

export function ExerciseSheet({
  exercise,
  onClose,
  onSave,
}: {
  exercise: ProgramExercise | null;
  onClose: () => void;
  onSave: (exercise: ProgramExercise) => void;
}) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState('');
  const [load, setLoad] = useState('');
  const [rest, setRest] = useState('');
  const [notes, setNotes] = useState('');
  const [catalogId, setCatalogId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exercise) return;
    setName(exercise.name);
    setSets(exercise.sets || 3);
    setReps(exercise.reps);
    setLoad(exercise.load ?? '');
    setRest(exercise.restSec !== undefined ? String(exercise.restSec) : '');
    setNotes(exercise.notes ?? '');
    setCatalogId(exercise.catalogId);
    setSearch('');
    setError(null);
  }, [exercise]);

  const matches = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return q.length < 2 ? [] : EXERCISES.filter((e) => e.name.toLocaleLowerCase('tr').includes(q)).slice(0, 6);
  }, [search]);

  if (!exercise) return null;

  const save = () => {
    const restSec = rest.trim() ? Number(rest) : undefined;
    if (!name.trim() || !reps.trim()) return setError('Ad ve tekrar zorunlu.');
    if (restSec !== undefined && !(Number.isInteger(restSec) && restSec >= 0 && restSec <= 600)) return setError('Dinlenme 0 ile 600 saniye arasında olmalı.');
    onSave({
      id: exercise.id ?? localId(),
      name: name.trim(),
      sets,
      reps: reps.trim(),
      load: load.trim() || undefined,
      restSec,
      notes: notes.trim() || undefined,
      catalogId,
    });
    onClose();
  };

  return (
    <BottomSheet visible onClose={onClose} title={exercise.id ? 'Egzersizi düzenle' : 'Egzersiz ekle'}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Örnek egzersizlerde ara (isteğe bağlı)" value={search} onChangeText={setSearch} icon="search-outline" />
      {matches.map((e, i) => (
        <ListRow
          key={e.id}
          title={e.name}
          subtitle={`${e.equipment} · örnek: ${e.duration}`}
          onPress={() => {
            setName(e.name);
            setCatalogId(e.id);
            setSearch('');
          }}
          last={i === matches.length - 1}
        />
      ))}
      <TextField label="Ad" value={name} onChangeText={setName} maxLength={80} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
        Set
      </Text>
      <Stepper value={sets} onChange={setSets} min={1} max={10} step={1} format={(v) => `${v}`} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Tekrar" value={reps} onChangeText={setReps} placeholder="8-10 · 30 sn" maxLength={20} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Yük (isteğe bağlı)" value={load} onChangeText={setLoad} placeholder="20 kg" maxLength={30} />
        </View>
      </View>
      <TextField label="Dinlenme (saniye, isteğe bağlı)" value={rest} onChangeText={setRest} keyboardType="number-pad" />
      <TextField label="Not (isteğe bağlı)" value={notes} onChangeText={setNotes} placeholder="ör. Dizlerini içe kapatma" maxLength={200} />
      <Button label="Tamam" size="lg" block onPress={save} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
