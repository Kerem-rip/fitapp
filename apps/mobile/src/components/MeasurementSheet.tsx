// Ölçüm ekleme penceresi: danışan kendi ölçümünü, uzman danışan adına ölçüm girer.
// Her ölçümde yöntem seçilir; çünkü aynı değer farklı yöntemle farklı çıkabilir.
import type { MeasurementItem, MeasurementKind, MeasurementMethod } from '@fitapp/api-client';
import { BottomSheet, Button, Notice, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { errorText } from '@/auth/actions';
import { KIND_LABELS, KIND_METHODS, KIND_ORDER, METHOD_LABELS, parseDateInput } from '@/features/health/labels';
import { ChipRow } from './ChipRow';

const num = (text: string) => Number(text.replace(',', '.'));

export function MeasurementSheet({
  visible,
  onClose,
  onSubmit,
  allowedKinds = KIND_ORDER,
  title = 'Ölçüm ekle',
  defaultKind = 'WEIGHT',
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: { kind: MeasurementKind; value: number; method: MeasurementMethod; takenAt?: string; deviceName?: string; note?: string }) => Promise<MeasurementItem | void>;
  // Uzman için sadece danışanın paylaştığı kategorilerin türleri
  allowedKinds?: MeasurementKind[];
  title?: string;
  defaultKind?: MeasurementKind;
}) {
  const [kind, setKind] = useState<MeasurementKind>(defaultKind);
  const [method, setMethod] = useState<MeasurementMethod>(KIND_METHODS[defaultKind][0]!);
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [device, setDevice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      const first = allowedKinds.includes(defaultKind) ? defaultKind : (allowedKinds[0] ?? defaultKind);
      setKind(first);
      setMethod(KIND_METHODS[first][0]!);
      setValue('');
      setDate('');
      setDevice('');
      setNote('');
      setError(null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickKind = (next: MeasurementKind) => {
    setKind(next);
    if (!KIND_METHODS[next].includes(method)) setMethod(KIND_METHODS[next][0]!);
  };

  const submit = async () => {
    if (busy) return;
    const amount = num(value);
    const takenAt = parseDateInput(date);
    if (!value.trim() || !Number.isFinite(amount)) return setError('Değeri sayı olarak yaz.');
    if (takenAt === null) return setError('Tarihi GG.AA.YYYY biçiminde yaz (bugünden ilerisi olamaz) ya da boş bırak.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ kind, value: amount, method, takenAt, deviceName: device.trim() || undefined, note: note.trim() || undefined });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Ne ölçtün?
      </Text>
      <ChipRow wrap options={allowedKinds.map((k) => ({ key: k, label: KIND_LABELS[k] }))} selected={[kind]} onToggle={pickKind} />
      <TextField label="Değer" value={value} onChangeText={setValue} keyboardType="decimal-pad" hint="Ondalık için virgül kullanabilirsin" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Nasıl ölçüldü?
      </Text>
      <ChipRow wrap options={KIND_METHODS[kind].map((m) => ({ key: m, label: METHOD_LABELS[m] }))} selected={[method]} onToggle={setMethod} />
      {method === 'BIA' || method === 'DEXA' || method === 'OTHER' ? (
        <TextField label="Cihaz (isteğe bağlı)" value={device} onChangeText={setDevice} />
      ) : null}
      <TextField label="Ölçüm tarihi (isteğe bağlı)" value={date} onChangeText={setDate} placeholder="GG.AA.YYYY · boşsa şimdi" keyboardType="numbers-and-punctuation" />
      <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={300} />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
