// Ölçümlerim ve sağlık öyküm (danışan/kullanıcı). Girdiğin bilgileri sadece sen görürsün;
// bir uzmanla paylaşmak için "Paylaşım ve erişim" ekranından izin vermen gerekir.
import type { AnamnesisResponse, IntakeQuestionView, MeasurementItem } from '@fitapp/api-client';
import { Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SectionHeader, Segmented, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { AnswerSheet, answerText } from '@/components/AnswerSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { MeasurementSheet } from '@/components/MeasurementSheet';
import { changeText, formatFullDate, formatValue, KIND_LABELS, METHOD_LABELS, SOURCE_LABELS } from '@/features/health/labels';

export default function MyHealthScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'measurements' | 'anamnesis'>('measurements');
  const [measurements, setMeasurements] = useState<MeasurementItem[] | null>(null);
  const [anamnesis, setAnamnesis] = useState<AnamnesisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [answering, setAnswering] = useState<IntakeQuestionView | null>(null);
  const [voidTarget, setVoidTarget] = useState<MeasurementItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([api.myMeasurements(), api.myAnamnesis()]);
      setMeasurements(m);
      setAnamnesis(a);
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

  const sections = anamnesis
    ? anamnesis.questions.reduce<{ label: string; items: IntakeQuestionView[] }[]>((acc, q) => {
        const last = acc[acc.length - 1];
        if (last && last.label === q.sectionLabel) last.items.push(q);
        else acc.push({ label: q.sectionLabel, items: [q] });
        return acc;
      }, [])
    : [];

  const voidIt = async () => {
    if (!voidTarget) return;
    try {
      await api.voidMyMeasurement(voidTarget.id);
      showToast('Ölçüm geçersiz sayıldı', 'info');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Sağlık bilgilerim" subtitle="Ölçümlerim ve sağlık öyküm" onBack={() => router.back()} />
      <Segmented
        options={[
          { key: 'measurements', label: 'Ölçümlerim' },
          { key: 'anamnesis', label: 'Sağlık öyküm' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error ? <Notice kind="danger" text={error} /> : null}
      <Notice kind="info" text="Bu bilgileri uzmanın görebilmesi için Profil › Paylaşım ve erişim bölümünden izin vermen gerekir. İzni istediğin an kapatabilirsin." />

      {tab === 'measurements' ? (
        <>
          <Button label="Ölçüm ekle" icon="add-circle-outline" size="lg" block onPress={() => setAddOpen(true)} style={{ marginBottom: 12 }} />
          {measurements && measurements.length === 0 ? (
            <EmptyState icon="scale-outline" title="Henüz ölçüm yok" text="Kilo, boy ve çevre ölçülerini ekleyebilirsin." />
          ) : null}
          {measurements && measurements.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {measurements.map((m, i) => (
                <ListRow
                  key={m.id}
                  icon="analytics-outline"
                  title={`${KIND_LABELS[m.kind]} · ${formatValue(m)}${changeText(m, measurements)}`}
                  subtitle={`${formatFullDate(m.takenAt)} · ${METHOD_LABELS[m.method]} · ${SOURCE_LABELS[m.source]}`}
                  trailing={m.source === 'SELF' ? <Button label="Geçersiz say" variant="ghost" size="sm" onPress={() => setVoidTarget(m)} /> : <Tag label="Uzman girdi" kind="neutral" />}
                  last={i === measurements.length - 1}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <Notice kind="warning" text="Bu soru seti taslaktır; bir uzman tarafından henüz gözden geçirilmemiştir. Yanıtların sağlık kararı yerine geçmez." />
          {sections.map((section) => (
            <View key={section.label}>
              <SectionHeader title={section.label} />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {section.items.map((q, i) => (
                  <ListRow
                    key={q.key}
                    title={q.text}
                    subtitle={q.answer ? answerText(q, q.answer.value) : 'Yanıtlanmadı'}
                    trailing={q.askedBy ? <Tag label={q.askedBy} kind="accent" /> : undefined}
                    onPress={() => setAnswering(q)}
                    last={i === section.items.length - 1}
                  />
                ))}
              </Card>
            </View>
          ))}
          {sections.length === 0 && !error ? <Text tone="muted">Yükleniyor...</Text> : null}
        </>
      )}

      <MeasurementSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={async (input) => {
          await api.addMyMeasurement(input);
          showToast('Ölçüm eklendi');
          await load();
        }}
      />
      <AnswerSheet
        question={answering}
        onClose={() => setAnswering(null)}
        onSave={async (key, value) => {
          await api.answerMyAnamnesis(key, value);
          showToast('Yanıtın kaydedildi');
          await load();
        }}
      />
      <ConfirmSheet
        visible={voidTarget !== null}
        title="Ölçümü geçersiz say"
        text="Ölçüm listeden kalkar. Kayıt tamamen silinmez; yanlış giriş olarak geçmişte saklanır."
        confirmLabel="Geçersiz say"
        danger
        onConfirm={voidIt}
        onClose={() => setVoidTarget(null)}
      />
    </Screen>
  );
}
