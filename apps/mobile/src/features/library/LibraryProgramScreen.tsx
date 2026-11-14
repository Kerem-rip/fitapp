// Ücretsiz program: gün şablonları, her hareketin süresi ve dinlenmesi; "Programa katıl" / "Programdan ayrıl".
import type { LibraryProgramDetail } from '@fitapp/api-client';
import { BottomSheet, Button, Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatLong, formatShort } from '@/demo/dates';
import { durationText, LEVEL_TEXT, programMeta } from './labels';

const START_OPTIONS = [0, 1, 2, 3, 7].map((offset) => ({
  key: dateKey(offset),
  label: offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : formatShort(dateKey(offset)),
}));

export function LibraryProgramScreen() {
  const router = useRouter();
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
      showToast('Programa katıldın. Günlük görevlerin Programım sekmesinde.');
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

  return (
    <Screen>
      <ScreenHeader title={program?.title ?? 'Program'} subtitle={program ? programMeta(program) : undefined} onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}
      {program ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            <Tag label="Ücretsiz" kind="success" />
            <Tag label={program.categoryLabel} />
            <Tag label={LEVEL_TEXT[program.level] ?? program.level} kind="info" />
          </View>
          <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
            {program.description}
          </Text>

          {program.enrollment ? (
            <Card variant="soft">
              <Text variant="bodyStrong">Bu programdasın</Text>
              <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
                Başlangıç: {formatLong(program.enrollment.startDate)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Programıma git" size="sm" onPress={() => router.push('/program')} />
                <Button label="Programdan ayrıl" size="sm" variant="secondary" onPress={() => setLeaveOpen(true)} />
              </View>
            </Card>
          ) : (
            <Button label="Programa katıl" icon="add-circle-outline" block onPress={() => setJoinOpen(true)} />
          )}

          <SectionHeader title={program.preview.length > 1 ? 'Haftalık günler' : 'Günlük rutin'} />
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
          {program.preview.length > 1 ? (
            <Text variant="caption" tone="muted">
              Bu günler {program.weeks} hafta boyunca tekrar eder. Ağrı hissedersen dur; sağlık sorunun varsa önce doktoruna danış.
            </Text>
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={joinOpen} onClose={() => setJoinOpen(false)} title="Ne zaman başlıyorsun?">
        <ChipRow options={START_OPTIONS} selected={[start]} onToggle={setStart} wrap />
        <Text variant="caption" tone="secondary" style={{ marginTop: 10, marginBottom: 12 }}>
          Program günleri haftaya yayılır; her günün görevleri Programım sekmesinde sırasıyla çıkar.
        </Text>
        <Button label="Programa katıl" block onPress={join} disabled={busy} />
      </BottomSheet>

      <BottomSheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} title="Programdan ayrılmak istiyor musun?">
        <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
          Görevlerin Programım sekmesinden kalkar. İstediğin zaman yeniden katılabilirsin; ilerleme sıfırdan başlar.
        </Text>
        <Button label="Programdan ayrıl" variant="danger" block onPress={leave} disabled={busy} />
      </BottomSheet>
    </Screen>
  );
}
