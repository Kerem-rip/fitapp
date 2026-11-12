// Üyeler ve özel dersler (salon yöneticisi). Üyenin sağlık verisini yalnızca üye paylaşırsa görürsün.
import { BottomSheet, Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SearchBar, Segmented, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useMemo, useState } from 'react';
import { WeekStrip } from '@/components/WeekStrip';
import { formatLong } from '@/demo/dates';
import { LessonForm } from './LessonSheet';
import { RealLessons } from './RealLessons';
import { RealMembers } from './RealMembers';
import { useGym } from './useGym';
import { useGymInfo } from './useGymInfo';

type Seg = 'members' | 'lessons';

export function MembersScreen() {
  const { info, can } = useGymInfo();
  const { gym, members, lessons, today, staffName } = useGym();
  const [seg, setSeg] = useState<Seg>('members');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(today);
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return members.filter((m) => !q || m.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [members, query]);

  const privateLessons = lessons.filter((l) => l.kind === 'private');
  const day = privateLessons.filter((l) => l.date === date).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Üyeler" subtitle={info ? info.gym.name : `${members.length} üye · ${privateLessons.length} özel ders`} />
      <Segmented<Seg>
        options={[
          { key: 'members', label: 'Üyeler' },
          { key: 'lessons', label: info ? 'Dersler' : 'Özel dersler' },
        ]}
        value={seg}
        onChange={setSeg}
      />

      {seg === 'members' && info ? (
        <RealMembers canManage={can('members.manage')} />
      ) : seg === 'members' ? (
        <>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Üye ara" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {list.map((m, i) => (
              <ListRow
                key={m.id}
                avatar={m.name}
                title={m.name}
                subtitle={`${m.trainerId ? `Eğitmen: ${staffName(m.trainerId)}` : 'Eğitmen atanmamış'} · özel ders ${m.privateLessonsLeft} kaldı`}
                trailing={
                  m.membership === 'expiring' ? <Tag label={`${m.daysLeft} gün kaldı`} kind="warning" /> : <Tag label="Aktif" kind="success" />
                }
                last={i === list.length - 1}
              />
            ))}
          </Card>
          <Notice kind="success" text="Üyenin sağlık verisini yalnızca üye paylaşırsa görürsün." />
        </>
      ) : info ? (
        <RealLessons />
      ) : (
        <>
          <WeekStrip selected={date} onSelect={setDate} marked={privateLessons.map((l) => l.date)} />
          <Text variant="heading" style={{ marginBottom: 8 }}>
            {formatLong(date)}
          </Text>
          {day.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {day.map((l, i) => (
                <ListRow
                  key={l.id}
                  icon="barbell-outline"
                  title={`${l.time} · ${l.memberName ?? 'Üye'}`}
                  subtitle={`Eğitmen: ${staffName(l.trainerId)}`}
                  trailing={<Tag label="Özel ders" kind="accent" />}
                  last={i === day.length - 1}
                />
              ))}
            </Card>
          ) : (
            <EmptyState icon="calendar-clear-outline" title="Bu gün özel ders yok" />
          )}
          <Button label="Özel ders ekle" icon="add" size="lg" block onPress={() => setOpen(true)} style={{ marginTop: 8 }} />
        </>
      )}

      {gym ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title="Özel ders ekle">
          <LessonForm
            gymId={gym.id}
            date={date}
            onDone={() => {
              setOpen(false);
              showToast('Özel ders eklendi');
            }}
          />
        </BottomSheet>
      ) : null}
    </Screen>
  );
}
