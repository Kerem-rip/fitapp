// Ders ekleme penceresi (gerçek veri). Sahip/resepsiyon grup ve özel ders açar; eğitmen sadece kendine özel ders açar.
// Açıldığı an kurulur; her açılışta temiz başlar.
import type { GymLessonKind, GymMemberListItem, GymShiftRow, GymWarning } from '@fitapp/api-client';
import { BottomSheet, Button, ListRow, Notice, Text, TextField } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { formatLong } from '@/demo/dates';
import { MemberPicker } from './MemberPicker';

const DURATIONS = [30, 45, 60, 90];
const REPEATS = [1, 4, 8, 12];

export function LessonCreateSheet({
  date,
  manager,
  selfId,
  team,
  onClose,
  onCreated,
}: {
  date: string;
  // Sahip/resepsiyon: her ders; değilse sadece kendine özel ders
  manager: boolean;
  selfId: string;
  team: GymShiftRow[];
  onClose: () => void;
  onCreated: (warning: GymWarning | null, count: number) => void;
}) {
  const trainers = team.filter((t) => t.role !== 'RECEPTION');
  const [kind, setKind] = useState<GymLessonKind>(manager ? 'GROUP' : 'PRIVATE');
  const [title, setTitle] = useState('');
  const [trainerId, setTrainerId] = useState(manager ? (trainers.find((t) => t.role === 'TRAINER') ?? trainers[0])?.user.id ?? '' : selfId);
  const [member, setMember] = useState<GymMemberListItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState('12');
  const [repeat, setRepeat] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) return setError('Saati SS:DD biçiminde yaz (ör. 18:00).');
    if (!trainerId) return setError('Dersi verecek eğitmeni seç.');
    if (kind === 'PRIVATE' && !member) return setError('Özel ders için üye seç.');
    const cap = Number(capacity);
    if (kind === 'GROUP' && (!Number.isInteger(cap) || cap < 1 || cap > 200)) return setError('Kontenjanı 1–200 arası yaz.');
    if (kind === 'GROUP' && title.trim().length < 2) return setError('Ders adını yaz (ör. Pilates).');
    setBusy(true);
    setError(null);
    try {
      const res = await api.createGymLesson({
        kind,
        title: kind === 'GROUP' ? title.trim() : undefined,
        trainerId,
        date,
        startTime: time.trim(),
        durationMin: duration,
        capacity: kind === 'GROUP' ? cap : undefined,
        memberId: member?.id,
        repeatWeeks: repeat > 1 ? repeat : undefined,
      });
      onCreated(res.warning, res.lessons.length);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title={`Ders ekle · ${formatLong(date)}`}>
      {error ? <Notice kind="warning" text={error} /> : null}
      {manager ? (
        <ChipRow
          options={[
            { key: 'GROUP' as const, label: 'Grup dersi' },
            { key: 'PRIVATE' as const, label: 'Özel ders' },
          ]}
          selected={[kind]}
          onToggle={setKind}
        />
      ) : (
        <Notice kind="info" text="Kendine özel ders ekleyebilirsin. Grup dersi programını salon yönetimi kurar." />
      )}
      {kind === 'GROUP' ? <TextField label="Ders adı" value={title} onChangeText={setTitle} maxLength={60} placeholder="ör. Pilates" /> : null}

      {manager ? (
        <>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
            Eğitmen
          </Text>
          {trainers.length === 0 ? <Notice kind="info" text="Ekipte eğitmen yok." /> : null}
          <ChipRow wrap options={trainers.map((t) => ({ key: t.user.id, label: t.user.name }))} selected={[trainerId]} onToggle={setTrainerId} />
        </>
      ) : null}

      {kind === 'PRIVATE' ? (
        <>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
            Üye
          </Text>
          {member && !picking ? (
            <ListRow avatar={member.fullName} title={member.fullName} subtitle="Değiştirmek için dokun" onPress={() => setPicking(true)} last />
          ) : (
            <MemberPicker
              onPick={(m) => {
                setMember(m);
                setPicking(false);
              }}
            />
          )}
        </>
      ) : (
        <TextField label="Kontenjan" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
      )}

      <TextField label="Başlangıç saati" value={time} onChangeText={setTime} placeholder="18:00" keyboardType="numbers-and-punctuation" />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Süre
      </Text>
      <ChipRow wrap options={DURATIONS.map((d) => ({ key: String(d), label: `${d} dk` }))} selected={[String(duration)]} onToggle={(k) => setDuration(Number(k))} />
      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Tekrar
      </Text>
      <ChipRow
        wrap
        options={REPEATS.map((r) => ({ key: String(r), label: r === 1 ? 'Tek sefer' : `${r} hafta` }))}
        selected={[String(repeat)]}
        onToggle={(k) => setRepeat(Number(k))}
      />
      {repeat > 1 ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          Her hafta aynı gün ve saatte ayrı bir ders oluşur; istediğin haftayı tek başına iptal edebilirsin.
        </Text>
      ) : null}
      <Button label={busy ? 'Kaydediliyor...' : 'Dersi ekle'} size="lg" block disabled={busy} onPress={submit} style={{ marginBottom: 8 }} />
    </BottomSheet>
  );
}
