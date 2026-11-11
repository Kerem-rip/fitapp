// Plan seçeneği (alternatif) ekleme/düzenleme. Uzman örnek yiyecekten başlayabilir ama değerler onun sorumluluğundadır.
import type { PlanOption } from '@fitapp/api-client';
import { ALLERGEN_LABELS_TR, ALLERGENS } from '@fitapp/shared';
import { BottomSheet, Button, ListRow, Notice, SwitchRow, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { allergenText, localId, optionFromFood, SEED_FOODS } from './helpers';

export function OptionSheet({
  option,
  onClose,
  onSave,
}: {
  // null: kapalı · {}: yeni seçenek · dolu: düzenleme
  option: PlanOption | null;
  onClose: () => void;
  onSave: (option: PlanOption) => void;
}) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [kcal, setKcal] = useState('');
  const [allergens, setAllergens] = useState<string[] | null>([]);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!option) return;
    setName(option.name ?? '');
    setPortion(option.portion ?? '');
    setKcal(option.kcal !== undefined ? String(option.kcal) : '');
    setAllergens(option.allergens === undefined ? [] : option.allergens);
    setNote(option.note ?? '');
    setSearch('');
    setError(null);
  }, [option]);

  const matches = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return q.length < 2 ? [] : SEED_FOODS.filter((f) => f.name.toLocaleLowerCase('tr').includes(q)).slice(0, 6);
  }, [search]);

  if (!option) return null;

  const save = () => {
    const amount = kcal.trim() ? Number(kcal.replace(',', '.')) : undefined;
    if (!name.trim() || !portion.trim()) return setError('Ad ve porsiyon zorunlu.');
    if (amount !== undefined && !(amount >= 0 && amount <= 5000)) return setError('Kalori 0 ile 5000 arasında olmalı.');
    onSave({ id: option.id ?? localId(), name: name.trim(), portion: portion.trim(), kcal: amount, allergens, note: note.trim() || undefined });
    onClose();
  };

  const toggle = (a: string) => setAllergens((cur) => (cur === null ? [a] : cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  return (
    <BottomSheet visible onClose={onClose} title={option.id ? 'Seçeneği düzenle' : 'Seçenek ekle'}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Örnek yiyecekte ara (isteğe bağlı)" value={search} onChangeText={setSearch} icon="search-outline" />
      {matches.map((f, i) => (
        <ListRow
          key={f.id}
          title={f.name}
          subtitle={`${f.portion} · ${f.kcal} kcal · örnek veri`}
          onPress={() => {
            const o = optionFromFood(f);
            setName(o.name);
            setPortion(o.portion);
            setKcal(String(o.kcal));
            setAllergens(o.allergens);
            setSearch('');
          }}
          last={i === matches.length - 1}
        />
      ))}
      {matches.length > 0 ? (
        <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>
          Örnek değerler tahminidir; porsiyon, kalori ve alerjenleri kontrol et.
        </Text>
      ) : null}
      <TextField label="Ad" value={name} onChangeText={setName} maxLength={80} />
      <TextField label="Porsiyon" value={portion} onChangeText={setPortion} placeholder="ör. 1 kase (200 g)" maxLength={60} />
      <TextField label="Kalori (isteğe bağlı)" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" />
      <SwitchRow
        title="Alerjen bilgisi belirtilmedi"
        description="Açıksa, alerjisi olan danışanda bu seçenek onaylanamaz."
        value={allergens === null}
        onChange={(v) => setAllergens(v ? null : [])}
        last
      />
      {allergens !== null ? (
        <View style={{ marginTop: 8 }}>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
            İçerdiği alerjenler · {allergenText(allergens)}
          </Text>
          <ChipRow wrap options={ALLERGENS.map((a) => ({ key: a, label: ALLERGEN_LABELS_TR[a] }))} selected={allergens} onToggle={toggle} />
        </View>
      ) : null}
      <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={200} />
      <Button label="Tamam" size="lg" block onPress={save} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
