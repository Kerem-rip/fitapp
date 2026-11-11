// Anamnez sorusu yanıt penceresi (danışan kendisi ya da uzman danışan adına kullanır). Soru türüne göre alan değişir.
import type { AnswerValue, IntakeQuestionView } from '@fitapp/api-client';
import { BottomSheet, Button, Notice, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { errorText } from '@/auth/actions';
import { ChipRow } from './ChipRow';

export function AnswerSheet({
  question,
  onClose,
  onSave,
}: {
  question: IntakeQuestionView | null;
  onClose: () => void;
  onSave: (key: string, value: AnswerValue) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!question) return;
    const current = question.answer?.value;
    setText(typeof current === 'string' || typeof current === 'number' ? String(current) : '');
    setChoices(Array.isArray(current) ? current : typeof current === 'string' && question.type === 'SINGLE_CHOICE' ? [current] : []);
    setError(null);
  }, [question]);

  if (!question) return null;

  const toggle = (value: string) => {
    if (question.type === 'SINGLE_CHOICE') return setChoices([value]);
    // "Yok / alerjim yok" seçilince diğerleri kalkar, başka seçenek seçilince "Yok" kalkar
    setChoices((cur) => {
      if (value === 'none') return cur.includes('none') ? [] : ['none'];
      const without = cur.filter((c) => c !== 'none');
      return without.includes(value) ? without.filter((c) => c !== value) : [...without, value];
    });
  };

  const save = async () => {
    if (busy) return;
    let value: AnswerValue;
    if (question.type === 'TEXT') {
      if (!text.trim()) return setError('Yanıtı yaz.');
      value = text.trim();
    } else if (question.type === 'NUMBER') {
      const n = Number(text.replace(',', '.'));
      if (!text.trim() || !Number.isFinite(n)) return setError('Sayı yaz.');
      value = n;
    } else {
      if (choices.length === 0) return setError('Bir seçenek seç.');
      value = question.type === 'SINGLE_CHOICE' ? choices[0]! : choices;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(question.key, value);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Yanıt">
      <Text variant="bodyStrong" style={{ marginBottom: 10 }}>
        {question.text}
      </Text>
      {error ? <Notice kind="warning" text={error} /> : null}
      {question.type === 'TEXT' ? <TextField label="Yanıt" value={text} onChangeText={setText} multiline maxLength={1000} /> : null}
      {question.type === 'NUMBER' ? (
        <TextField
          label={question.unit ? `Yanıt (${question.unit})` : 'Yanıt'}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          hint={question.min !== null && question.max !== null ? `${question.min} ile ${question.max} arasında` : undefined}
        />
      ) : null}
      {question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE' ? (
        <ChipRow
          wrap
          options={(question.options ?? []).map((o) => ({ key: o.value, label: o.label }))}
          selected={choices}
          onToggle={toggle}
        />
      ) : null}
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={save} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}

// Kayıtlı yanıtı okunur metne çevirir
export function answerText(question: Pick<IntakeQuestionView, 'options' | 'unit'>, value: AnswerValue): string {
  const label = (v: string) => question.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map(label).join(', ');
  if (typeof value === 'number') return question.unit ? `${value} ${question.unit}` : String(value);
  return label(value);
}
