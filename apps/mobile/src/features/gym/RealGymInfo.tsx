// Salon bilgileri (gerçek veri): ad, adres, şehir, telefon. Sadece salon sahibi düzenler.
// Tahsilat raporuna buradan gidilir (sadece sahip).
import type { GymInfo } from '@fitapp/api-client';
import { BottomSheet, Button, Card, ListRow, Notice, SectionHeader, showToast, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

export function RealGymInfo({ info, canEdit, canReport, onSaved }: { info: GymInfo; canEdit: boolean; canReport: boolean; onSaved: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const g = info.gym;

  return (
    <>
      <SectionHeader title="Salon bilgileri" action={canEdit ? 'Düzenle' : undefined} onAction={canEdit ? () => setEditing(true) : undefined} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="business-outline" title={g.name} subtitle="Salon adı" />
        <ListRow icon="location-outline" title={[g.address, g.city].filter(Boolean).join(', ') || 'Adres yazılmamış'} subtitle="Adres" />
        <ListRow icon="call-outline" title={g.phone || 'Telefon yazılmamış'} subtitle="Telefon" last={!canReport} />
        {canReport ? <ListRow icon="bar-chart-outline" title="Tahsilat raporu" subtitle="Günlere ve ödeme türüne göre kayıtlar" onPress={() => router.push('/gym-report')} last /> : null}
      </Card>

      {editing ? (
        <EditSheet
          gym={g}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            showToast('Salon bilgileri güncellendi');
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

function EditSheet({ gym, onClose, onSaved }: { gym: GymInfo['gym']; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(gym.name);
  const [address, setAddress] = useState(gym.address ?? '');
  const [city, setCity] = useState(gym.city ?? '');
  const [phone, setPhone] = useState(gym.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (name.trim().length < 2) return setError('Salon adını yaz.');
    setBusy(true);
    setError(null);
    try {
      await api.updateGym({ name: name.trim(), address: address.trim() || null, city: city.trim() || null, phone: phone.trim() || null });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title="Salon bilgileri">
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Salon adı" value={name} onChangeText={setName} maxLength={80} />
      <TextField label="Adres" value={address} onChangeText={setAddress} maxLength={200} />
      <TextField label="Şehir" value={city} onChangeText={setCity} maxLength={60} autoCapitalize="words" />
      <TextField label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
      <Notice kind="info" text="Salon adı ekip ekranlarında ve davet bildirimlerinde görünür." />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
