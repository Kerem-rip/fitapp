// Kısıt seçici: sakatlık ya da rahatsızlık olan bölgeler seçilir; kartlardaki o bölgeyi yükleyen hareketler değiştirilir.
import type { BodyAreaKey } from '@fitapp/api-client';
import { Text } from '@fitapp/ui-mobile';
import { ChipRow } from '@/components/ChipRow';

export const RESTRICTIONS: { key: BodyAreaKey; label: string }[] = [
  { key: 'KNEE', label: 'Diz' },
  { key: 'LOW_BACK', label: 'Bel' },
  { key: 'WRIST', label: 'Bilek' },
  { key: 'SHOULDER', label: 'Omuz' },
  { key: 'ANKLE', label: 'Ayak bileği' },
  { key: 'NECK', label: 'Boyun' },
  { key: 'HIP', label: 'Kalça' },
];

export const parseAvoidParam = (s?: string): BodyAreaKey[] => (s ? s.split(',').filter((k): k is BodyAreaKey => RESTRICTIONS.some((r) => r.key === k)) : []);

export function RestrictionPicker({ value, onChange }: { value: BodyAreaKey[]; onChange: (v: BodyAreaKey[]) => void }) {
  return (
    <>
      <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
        Ağrı ya da sakatlığın olan bölgeyi seç; o bölgeyi yoran hareketler değiştirilir.
      </Text>
      <ChipRow options={RESTRICTIONS} selected={value} onToggle={(k) => onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k])} />
    </>
  );
}
