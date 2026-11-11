// Üyelik paketleri (salon sahibi): ad, süre, ders hakkı ve fiyat. Paket silinmez, satıştan kaldırılır.
// Fiyat değişse de önceden satılmış üyelikler kendi ücretiyle kalır.
import type { MembershipPlanItem } from '@fitapp/api-client';
import { BottomSheet, Button, Card, ListRow, Notice, SectionHeader, showToast, Tag, TextField } from '@fitapp/ui-mobile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { formatTL, parseTL } from './labels';

export function RealPlans() {
  const [plans, setPlans] = useState<MembershipPlanItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MembershipPlanItem | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      setPlans(await api.gymPlans(true));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <>
      <SectionHeader title="Üyelik paketleri" action="Ekle" onAction={() => setEditing('new')} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {plans && plans.length === 0 ? <Notice kind="info" text="Henüz paket yok. Üyelik satabilmek için bir paket ekle." /> : null}
      {plans && plans.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {plans.map((p, i) => (
            <ListRow
              key={p.id}
              icon="pricetag-outline"
              title={`${p.name} · ${formatTL(p.priceKurus)}`}
              subtitle={`${p.durationDays} gün${p.sessionCount ? ` · ${p.sessionCount} ders` : ''}`}
              trailing={p.active ? undefined : <Tag label="Satışta değil" kind="neutral" />}
              onPress={() => setEditing(p)}
              last={i === plans.length - 1}
            />
          ))}
        </Card>
      ) : null}

      {editing ? (
        <PlanSheet
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            showToast(message);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function PlanSheet({ plan, onClose, onSaved }: { plan: MembershipPlanItem | 'new'; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const isNew = plan === 'new';
  const [name, setName] = useState(isNew ? '' : plan.name);
  const [days, setDays] = useState(isNew ? '30' : String(plan.durationDays));
  const [sessions, setSessions] = useState(!isNew && plan.sessionCount ? String(plan.sessionCount) : '');
  const [price, setPrice] = useState(isNew ? '' : String(plan.priceKurus / 100).replace('.', ','));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onSaved(message);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (busy) return;
    if (name.trim().length < 2) return setError('Paket adını yaz.');
    const kurus = price.trim() === '0' ? 0 : parseTL(price);
    if (kurus === null) return setError('Fiyatı TL olarak yaz (ör. 1.500).');
    if (plan === 'new') {
      const durationDays = Number(days);
      const sessionCount = sessions.trim() ? Number(sessions) : undefined;
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 730) return setError('Süreyi 1–730 gün arasında yaz.');
      if (sessionCount !== undefined && (!Number.isInteger(sessionCount) || sessionCount < 1)) return setError('Ders hakkını tam sayı olarak yaz ya da boş bırak.');
      return run(() => api.addGymPlan({ name: name.trim(), durationDays, sessionCount, priceKurus: kurus }), 'Paket eklendi');
    }
    return run(() => api.updateGymPlan(plan.id, { name: name.trim(), priceKurus: kurus }), 'Paket güncellendi');
  };

  return (
    <BottomSheet visible onClose={onClose} title={isNew ? 'Paket ekle' : 'Paketi düzenle'}>
      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Paket adı" value={name} onChangeText={setName} maxLength={60} placeholder="ör. 1 aylık" />
      {isNew ? (
        <>
          <TextField label="Süre (gün)" value={days} onChangeText={setDays} keyboardType="number-pad" />
          <TextField label="Ders hakkı (isteğe bağlı)" value={sessions} onChangeText={setSessions} keyboardType="number-pad" hint="Sınırsız girişli paketlerde boş bırak." />
        </>
      ) : (
        <Notice kind="info" text="Süre ve ders hakkı satılmış üyelikleri etkilememesi için değiştirilemez; gerekirse yeni paket ekle." />
      )}
      <TextField label="Fiyat (TL)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={save} style={{ marginBottom: 8 }} />
      {plan !== 'new' ? (
        <Button
          label={plan.active ? 'Satıştan kaldır' : 'Yeniden satışa aç'}
          variant="ghost"
          block
          disabled={busy}
          onPress={() => run(() => api.updateGymPlan(plan.id, { active: !plan.active }), plan.active ? 'Paket satıştan kaldırıldı' : 'Paket satışa açıldı')}
          style={{ marginBottom: 8 }}
        />
      ) : null}
    </BottomSheet>
  );
}
