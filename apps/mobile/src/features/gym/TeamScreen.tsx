// Ekip (salon yöneticisi): personel listesi, haftalık vardiya ve yeni eğitmen daveti.
// Bir eğitmen tek bir salona bağlıdır ve davetle, kendi hesabıyla katılır (şifreyi yönetici belirlemez).
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, Segmented, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { inviteStaff, setShift } from '@/demo/actions';
import { DAY_SHORT } from '@/demo/dates';
import { WEEKDAY_FULL } from '@/demo/labels';
import { RealStaffInvite, RealStaffList } from './RealStaff';
import { useGym } from './useGym';
import { useGymInfo } from './useGymInfo';

type Seg = 'staff' | 'shifts' | 'invite';

const SHIFT_PRESETS = ['08:00–16:00', '09:00–17:00', '12:00–20:00', '16:00–23:00', 'İzinli'];

export function TeamScreen() {
  const { gym, staff, todayIndex } = useGym();
  const { info, can } = useGymInfo();
  const [seg, setSeg] = useState<Seg>('staff');
  const [day, setDay] = useState(todayIndex);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'trainer' | 'reception'>('trainer');
  const [nameError, setNameError] = useState<string | undefined>();

  const editStaff = staff.find((s) => s.id === editing);

  const invite = () => {
    if (!name.trim()) {
      setNameError('Ad soyad yaz');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      showToast('Geçerli bir e-posta yaz', 'warning');
      return;
    }
    if (!gym) return;
    inviteStaff({ gymId: gym.id, name, role });
    showToast(`${name.trim()} için davet gönderildi`);
    setName('');
    setEmail('');
    setNameError(undefined);
    setSeg('staff');
  };

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Ekip" subtitle={info ? info.gym.name : `${staff.length} kişi`} />
      <Segmented<Seg>
        options={[
          { key: 'staff', label: 'Personel' },
          { key: 'shifts', label: 'Vardiya' },
          ...(!info || can('staff.manage') ? [{ key: 'invite' as const, label: 'Davet' }] : []),
        ]}
        value={seg}
        onChange={setSeg}
      />

      {seg === 'staff' && info ? <RealStaffList canManage={can('staff.manage')} /> : null}
      {seg === 'invite' && info ? <RealStaffInvite onInvited={() => setSeg('staff')} /> : null}
      {info && seg === 'shifts' ? <Notice kind="info" text="Vardiyalar henüz örnek veriyle çalışıyor; sıradaki aşamada gerçek ekibe bağlanacak." /> : null}

      {seg === 'staff' && !info ? (
        staff.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {staff.map((s, i) => (
              <ListRow
                key={s.id}
                avatar={s.name}
                title={s.name}
                subtitle={`${s.role === 'trainer' ? 'Eğitmen' : 'Resepsiyon'} · bugün ${s.shifts[todayIndex]}`}
                trailing={s.invited ? <Tag label="Davet gönderildi" kind="warning" /> : <Tag label="Aktif" kind="success" />}
                last={i === staff.length - 1}
              />
            ))}
          </Card>
        ) : (
          <EmptyState icon="people-outline" title="Henüz ekip yok" text="Davet sekmesinden eğitmen ekleyebilirsin." />
        )
      ) : null}

      {seg === 'shifts' ? (
        <>
          <ChipRow
            options={DAY_SHORT.map((d, i) => ({ key: String(i), label: d }))}
            selected={[String(day)]}
            onToggle={(k) => setDay(Number(k))}
          />
          <Text variant="heading" style={{ marginBottom: 8 }}>
            {WEEKDAY_FULL[day]} vardiyası
          </Text>
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {staff.map((s, i) => (
              <ListRow
                key={s.id}
                avatar={s.name}
                title={s.name}
                subtitle={s.role === 'trainer' ? 'Eğitmen' : 'Resepsiyon'}
                trailing={<Tag label={s.shifts[day] ?? 'İzinli'} kind={s.shifts[day] === 'İzinli' ? 'neutral' : 'accent'} icon="time-outline" />}
                onPress={() => setEditing(s.id)}
                last={i === staff.length - 1}
              />
            ))}
          </Card>
          <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
            Düzenlemek için bir kişiye dokun. Personel kendi vardiyasını uygulamasında görür.
          </Text>
        </>
      ) : null}

      {seg === 'invite' && !info ? (
        <View>
          <TextField label="Ad soyad" value={name} onChangeText={(t) => { setName(t); setNameError(undefined); }} autoCapitalize="words" error={nameError} />
          <TextField label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
            Rol
          </Text>
          <ChipRow
            wrap
            options={[
              { key: 'trainer' as const, label: 'Eğitmen' },
              { key: 'reception' as const, label: 'Resepsiyon' },
            ]}
            selected={[role]}
            onToggle={setRole}
          />
          <Notice kind="info" text="Davet e-postası gider. Eğitmen kendi hesabıyla katılır; şifresini sen bilmezsin. Bir eğitmen tek bir salona bağlıdır." />
          <Button label="Davet gönder" size="lg" block icon="send-outline" onPress={invite} />
        </View>
      ) : null}

      <BottomSheet visible={editStaff !== undefined} onClose={() => setEditing(null)} title={editStaff ? `${editStaff.name} · ${WEEKDAY_FULL[day]}` : ''}>
        {SHIFT_PRESETS.map((preset, i) => (
          <ListRow
            key={preset}
            icon={preset === 'İzinli' ? 'moon-outline' : 'time-outline'}
            title={preset}
            trailing={editStaff?.shifts[day] === preset ? <Tag label="Seçili" kind="accent" /> : undefined}
            onPress={() => {
              if (editStaff) setShift(editStaff.id, day, preset);
              setEditing(null);
              showToast('Vardiya güncellendi');
            }}
            last={i === SHIFT_PRESETS.length - 1}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}
