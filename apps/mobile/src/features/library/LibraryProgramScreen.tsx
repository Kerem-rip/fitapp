// Program / 28 günlük paket: büyük görsel, bilgi satırı, hafta hafta plan (her gün bir antrenman kartı) ve altta sabit "Programa katıl".
import type { LibraryProgramDetail } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Icon, Notice, Screen, ScreenHeader, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatLong, formatShort } from '@/demo/dates';
import { HeroImage } from '@/features/workout/CardHero';
import { DEMO_CREDITS } from '@/features/workout/demoMedia';
import { durationText, LEVEL_TEXT } from './labels';

const START_OPTIONS = [0, 1, 2, 3, 7].map((offset) => ({
  key: dateKey(offset),
  label: offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : formatShort(dateKey(offset)),
}));

function Meta({ icon, text }: { icon: 'calendar-outline' | 'time-outline' | 'bar-chart-outline' | 'flag-outline'; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={20} color={c.textSecondary} />
      <Text variant="bodyStrong" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

export function LibraryProgramScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [program, setProgram] = useState<LibraryProgramDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [start, setStart] = useState(START_OPTIONS[0]!.key);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .libraryProgram(id)
      .then((p) => {
        setProgram(p);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, [id]);
  useEffect(load, [load]);

  const join = async () => {
    setBusy(true);
    try {
      await api.joinLibraryProgram(id, start);
      setJoinOpen(false);
      showToast('Programa katıldın. Günlük görevlerin Görevlerim sekmesinde.');
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!program?.enrollment) return;
    setBusy(true);
    try {
      await api.leaveLibraryProgram(program.enrollment.id);
      setLeaveOpen(false);
      showToast('Programdan ayrıldın.');
      load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));
  const credit = program ? DEMO_CREDITS[program.hero] : undefined;
  const pack = program?.kind === 'PACK';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <ScreenHeader title="" onBack={back} />
        {error ? <Notice kind="danger" text={error} /> : null}
        {program ? (
          <>
            <HeroImage hero={program.hero} height={220} />
            {credit ? (
              <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
                Geçici demo görseli · {credit.author} · {credit.license} · Wikimedia Commons
              </Text>
            ) : null}
            <Text variant="title" style={{ marginTop: 16 }}>
              {program.title}
            </Text>
            <Text variant="body" tone="secondary" style={{ marginTop: 4, marginBottom: 14 }}>
              {program.description}
            </Text>
            <View style={{ flexDirection: 'row', gap: 18, flexWrap: 'wrap' }}>
              <Meta icon="calendar-outline" text={`${program.weeks * 7} gün`} />
              <Meta icon="time-outline" text={`~${program.minutesPerDay} dk / gün`} />
              <Meta icon="bar-chart-outline" text={LEVEL_TEXT[program.level] ?? program.level} />
            </View>
            {program.goal ? (
              <Text variant="caption" tone="muted" style={{ marginTop: 12, letterSpacing: 1 }}>
                HEDEF
              </Text>
            ) : null}
            {program.goal ? <Text variant="heading">{program.goal}</Text> : null}

            {program.enrollment ? (
              <Card variant="soft" style={{ marginTop: 16 }}>
                <Text variant="bodyStrong">Bu programdasın</Text>
                <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
                  Başlangıç: {formatLong(program.enrollment.startDate)}
                </Text>
                <Button label="Programdan ayrıl" size="sm" variant="secondary" onPress={() => setLeaveOpen(true)} />
              </Card>
            ) : null}

            {pack ? (
              program.weekPlan.map((w) => (
                <View key={w.week}>
                  <Text variant="heading" style={{ marginTop: 20, marginBottom: 8 }}>
                    {w.week}. hafta
                  </Text>
                  {w.days.map((d, i) => (
                    <Pressable
                      key={d.dayIndex}
                      onPress={() => (d.cardId ? router.push({ pathname: '/workout-card/[id]', params: { id: d.cardId } }) : undefined)}
                      accessibilityRole="button"
                      accessibilityLabel={`${i + 1}. antrenman: ${d.title}, ${d.minutes} dakika`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surfaceAlt, borderRadius: 18, padding: 14, marginBottom: 8 }}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Text variant="caption" style={{ color: c.text }}>
                          {i + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{d.title}</Text>
                        <Text variant="caption" tone="secondary">
                          ~{d.minutes} dk · {d.moveCount} hareket
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={18} color={c.textMuted} />
                    </Pressable>
                  ))}
                  <Text variant="micro" tone="muted">
                    Haftanın diğer günleri dinlenme günleridir.
                  </Text>
                </View>
              ))
            ) : (
              <>
                <Text variant="heading" style={{ marginTop: 20, marginBottom: 8 }}>
                  {program.preview.length > 1 ? 'Haftalık günler' : 'Günlük rutin'}
                </Text>
                {program.preview.map((d) => (
                  <Card key={d.dayIndex}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text variant="bodyStrong">{program.preview.length > 1 ? `${d.dayIndex + 1}. gün` : 'Her gün'}</Text>
                      <Text variant="caption" tone="muted">
                        ~{durationText(d.durationSec)}
                      </Text>
                    </View>
                    {d.steps.map((s, i) => (
                      <View key={s.index} style={{ paddingVertical: 6 }}>
                        <Text variant="body" onPress={() => router.push(`/library-item/${s.item.id}`)}>
                          {i + 1}. {s.item.title}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {s.workText} · ~{durationText(s.durationSec)}
                          {i < d.steps.length - 1 && s.restAfterSec ? ` · sonra ${s.restAfterSec} sn dinlen` : ''}
                        </Text>
                      </View>
                    ))}
                  </Card>
                ))}
              </>
            )}
            <View style={{ marginTop: 12 }}>
              <Notice kind="info" text="Sonuçlar kişiden kişiye değişir. Ağrı hissedersen dur; sağlık sorunun varsa önce doktoruna danış." />
            </View>
            <View style={{ height: 96 }} />
          </>
        ) : null}

        <BottomSheet visible={joinOpen} onClose={() => setJoinOpen(false)} title="Ne zaman başlıyorsun?">
          <ChipRow options={START_OPTIONS} selected={[start]} onToggle={setStart} wrap />
          <Text variant="caption" tone="secondary" style={{ marginTop: 10, marginBottom: 12 }}>
            Antrenman günleri haftaya yayılır; her günün görevleri Görevlerim sekmesinde sırasıyla çıkar.
          </Text>
          <Button label="Programa katıl" block onPress={join} disabled={busy} />
        </BottomSheet>

        <BottomSheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} title="Programdan ayrılmak istiyor musun?">
          <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
            Görevlerin Görevlerim sekmesinden kalkar. İstediğin zaman yeniden katılabilirsin; ilerleme sıfırdan başlar.
          </Text>
          <Button label="Programdan ayrıl" variant="danger" block onPress={leave} disabled={busy} />
        </BottomSheet>
      </Screen>

      {program ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border }}>
          {program.enrollment ? (
            <Button label="Görevlerime git" size="lg" block onPress={() => router.push('/program')} />
          ) : (
            <Button label="Programa katıl" icon="add-circle-outline" size="lg" block onPress={() => setJoinOpen(true)} />
          )}
        </View>
      ) : null}
    </View>
  );
}
