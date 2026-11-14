// Şikâyet et: neden seçilir, istenirse açıklama yazılır. Şikâyet moderatöre gider; şikâyet edilen kişi kimin şikâyet ettiğini görmez.
import type { ReportReason, ReportTarget } from '@fitapp/api-client';
import { BottomSheet, Button, Chip, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

export const REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'İstenmeyen içerik / reklam',
  HARASSMENT: 'Taciz veya zorbalık',
  HATE: 'Nefret söylemi',
  NUDITY: 'Çıplaklık / cinsel içerik',
  VIOLENCE: 'Şiddet',
  SELF_HARM: 'Kendine zarar verme',
  MISINFORMATION: 'Yanıltıcı sağlık bilgisi',
  IMPERSONATION: 'Sahte hesap / taklit',
  OTHER: 'Diğer',
};

export function ReportSheet({ target, onClose }: { target: { type: ReportTarget; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    onClose();
  };
  const submit = async () => {
    if (!target || !reason) return;
    setBusy(true);
    try {
      await api.report({ targetType: target.type, targetId: target.id, reason, details: details.trim() || null });
      showToast('Şikâyetin alındı. İnceleyeceğiz.');
      close();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={target !== null} onClose={close} title="Şikâyet et">
      <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
        Neden şikâyet ediyorsun? Şikâyet ettiğin kişi bunu senin yaptığını görmez.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
          <Chip key={r} label={REASON_LABELS[r]} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <TextField label="Açıklama (isteğe bağlı)" value={details} onChangeText={setDetails} multiline maxLength={500} autoCapitalize="sentences" />
      <Button label="Şikâyeti gönder" block onPress={submit} disabled={!reason || busy} />
      {reason === 'SELF_HARM' ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: 10 }}>
          Biri tehlikedeyse beklemeden 112&apos;yi ara.
        </Text>
      ) : null}
    </BottomSheet>
  );
}
