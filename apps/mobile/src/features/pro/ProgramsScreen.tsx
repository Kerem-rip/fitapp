// Programlar (bağımsız eğitmen): kendi programlarını hazırlar, danışanlarına atar.
// Herkese açık yayın için admin onayı gerekir.
import { BottomSheet, Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Stepper, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ChipRow } from '@/components/ChipRow';
import { createProgram } from '@/demo/actions';
import { EXERCISES } from '@/demo/content';
import { fullName } from '@/demo/selectors';
import { useAccount, useShared } from '@/demo/hooks';

export function ProgramsScreen() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(3);
  const [picked, setPicked] = useState<string[]>([]);

  if (!account) return null;
  const mine = shared.programs.filter((p) => p.authorId === account.id);
  const platform = shared.programs.filter((p) => p.authorId === null && p.status === 'published');

  const statusTag = (status: string) =>
    status === 'published' ? <Tag label="Yayında" kind="success" /> : status === 'pending' ? <Tag label="Onayda" kind="warning" /> : <Tag label="Taslak" kind="neutral" />;

  const save = () => {
    if (!title.trim()) {
      showToast('Programa bir ad ver', 'warning');
      return;
    }
    if (picked.length === 0) {
      showToast('En az bir egzersiz seç', 'warning');
      return;
    }
    const program = createProgram({ authorId: account.id, authorName: fullName(account), title, description, weeks, daysPerWeek: days, exerciseIds: picked });
    setOpen(false);
    setTitle('');
    setDescription('');
    setPicked([]);
    showToast('Program taslak olarak kaydedildi');
    router.push(`/program/${program.id}`);
  };

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Programlar" subtitle="Hazırla, danışanlarına ata" />

      <Button label="Yeni program" icon="add" size="lg" block onPress={() => setOpen(true)} style={{ marginBottom: 12 }} />

      <SectionHeader title="Programlarım" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {mine.map((p, i) => (
          <ListRow
            key={p.id}
            icon="albums-outline"
            title={p.title}
            subtitle={`${p.weeks} hafta · haftada ${p.daysPerWeek} gün`}
            trailing={statusTag(p.status)}
            onPress={() => router.push(`/program/${p.id}`)}
            last={i === mine.length - 1}
          />
        ))}
        {mine.length === 0 ? (
          <Text variant="caption" tone="muted" style={{ paddingVertical: 14 }}>
            Henüz programın yok.
          </Text>
        ) : null}
      </Card>
      <Notice kind="info" text="Herkese açık yayın için admin onayı gerekir. Taslağı onaya gönderince 'Onayda' durumuna geçer." />

      <SectionHeader title="fitapp programları" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {platform.map((p, i) => (
          <ListRow
            key={p.id}
            icon="albums-outline"
            title={p.title}
            subtitle={`${p.weeks} hafta · haftada ${p.daysPerWeek} gün`}
            onPress={() => router.push(`/program/${p.id}`)}
            last={i === platform.length - 1}
          />
        ))}
      </Card>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Yeni program">
        <TextField label="Program adı" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
        <TextField label="Kısa açıklama" value={description} onChangeText={setDescription} multiline maxLength={200} autoCapitalize="sentences" />
        <View style={{ flexDirection: 'row', gap: 24, marginBottom: 14 }}>
          <View>
            <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
              Hafta
            </Text>
            <Stepper value={weeks} onChange={setWeeks} min={1} max={12} step={1} format={(v) => `${v}`} />
          </View>
        </View>
        <View style={{ marginBottom: 14 }}>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
            Haftada gün
          </Text>
          <Stepper value={days} onChange={setDays} min={1} max={7} step={1} format={(v) => `${v}`} />
        </View>
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Egzersizler ({picked.length})
        </Text>
        <ChipRow
          wrap
          options={EXERCISES.map((e) => ({ key: e.id, label: e.name }))}
          selected={picked}
          onToggle={(id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
        />
        <Button label="Taslak olarak kaydet" size="lg" block onPress={save} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </Screen>
  );
}
