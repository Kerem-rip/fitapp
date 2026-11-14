// Kişisel 28 günlük program: tanıtım → form → (deneme) satın alma → başlangıç tarihi → takvim → rapor → yeni dönem.
// Durumun tamamı sunucudan gelir; ekran hiçbir şeyi kendisi belirlemez. Ödeme henüz yoktur: satın alma "deneme" olarak işaretlidir.
import type { PlanCatalog, PlanCurrent, PersonalPlanOverview } from '@fitapp/api-client';
import { Button, Card, EmptyState, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text } from '@fitapp/ui-mobile';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { dateKey, formatLong, formatShort, newId } from '@/demo/dates';
import { PHASE_LABELS, SOURCE_TAG } from './labels';

export function PlanHomeScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [cur, setCur] = useState<PlanCurrent | null>(null);
  const [overview, setOverview] = useState<PersonalPlanOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [start, setStart] = useState(dateKey(0));
  // Aynı satın alma denemesi tekrarlanırsa çift kayıt oluşmasın diye anahtar sabit tutulur
  const key = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, catalogData] = await Promise.all([api.planCurrent(), api.planCatalog()]);
      setCur(c);
      setCatalog(catalogData);
      setOverview(c.instance && !c.awaitingRepurchase ? await api.planOverview(c.instance.id) : null);
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

  const buy = async () => {
    setBusy(true);
    try {
      key.current ??= newId('plan-purchase');
      await api.planPurchase(key.current);
      key.current = null;
      showToast('Satın alma tamamlandı (deneme)');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };
  const startPlan = async () => {
    if (!cur?.purchase) return;
    setBusy(true);
    try {
      await api.planStart(cur.purchase.id, start);
      showToast('Başlangıç tarihin kaydedildi');
      await load();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/library'));
  const window = cur?.purchase ? Array.from({ length: 15 }, (_, i) => dateKey(i)).filter((d) => d <= cur.purchase!.startWindowEndsAt) : [];
  const ended = cur?.phase === 'COMPLETED' || cur?.phase === 'EXPIRED';

  return (
    <Screen>
      <ScreenHeader title="Kişisel 28 günlük program" subtitle="Sana özel, ilerlemene göre güncellenir" onBack={back} />
      {error ? <Notice kind="danger" text={error} /> : null}

      {/* ── Başlangıç tarihi seç ── */}
      {cur?.purchase ? (
        cur.phase === 'START_WINDOW_MISSED' ? (
          <Notice kind="warning" title="Başlangıç süresi geçti" text={`Başlangıç tarihi seçilmezse program ${catalog?.startWindowDays ?? 14}. günde otomatik başlar. Bu satın alma için otomatik başlatma yapılamadı; destek ekibiyle iletişime geç.`} />
        ) : (
          <>
            <Notice kind="success" title="Satın alma tamamlandı" text={`Programın ne zaman başlayacağını seç. ${formatShort(cur.purchase.startWindowEndsAt)} tarihine kadar seçebilirsin. Başladıktan sonra 28 gün kesintisiz ilerler; duraklatılamaz.`} />
            <ChipRow wrap options={window.map((d) => ({ key: d, label: d === dateKey(0) ? 'Bugün' : formatShort(d) }))} selected={[start]} onToggle={setStart} />
            <Text variant="caption" tone="secondary" style={{ marginVertical: 8 }}>
              Seçilen: {formatLong(start)} → bitiş {formatShort(dateKey(27 + Math.round((new Date(start).getTime() - new Date(dateKey(0)).getTime()) / 86400000)))}
            </Text>
            <Button label="Bu tarihte başla" block onPress={startPlan} disabled={busy} />
          </>
        )
      ) : null}

      {/* ── Aktif / planlı program: takvim ── */}
      {overview && cur?.instance ? (
        <>
          <Card variant="soft">
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <Tag label={SOURCE_TAG} kind="accent" />
              <Tag label={PHASE_LABELS[overview.phase] ?? overview.phase} kind={overview.phase === 'ACTIVE' ? 'success' : 'info'} />
              <Tag label={`${overview.sequence}. dönem`} />
            </View>
            <Text variant="heading">
              {formatShort(overview.startDate)} – {formatShort(overview.endDate)}
            </Text>
            <Text variant="caption" tone="secondary">
              {overview.currentDay ? `Bugün ${overview.currentDay}. gün · ` : overview.phase === 'AWAITING_START' ? 'Henüz başlamadı · ' : ''}
              {overview.progress.completedDays}/{overview.progress.trainingDays} antrenman günü tamam
            </Text>
          </Card>
          {overview.needsProfessional ? <Notice kind="warning" title="Uzmana danış" text="Ağrı bildirimlerin nedeniyle program hafifletildi. Ağrı sürüyorsa bir doktora ya da uzmana danışmanı öneririz." /> : null}
          {overview.adaptationLog.length ? (
            <Card>
              <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
                Programın nasıl güncellendi
              </Text>
              {overview.adaptationLog.slice(-4).map((l) => (
                <Text key={l} variant="caption" tone="secondary" style={{ marginBottom: 2 }}>
                  • {l}
                </Text>
              ))}
            </Card>
          ) : null}

          {[1, 2, 3, 4].map((week) => {
            const days = overview.days.filter((d) => d.weekNumber === week);
            const pending = overview.pendingWeeks.find((p) => p.week === week);
            return (
              <View key={week}>
                <SectionHeader title={`${week}. hafta · ${['Başlangıç', 'Kontrollü ilerleme', 'Uyarlama', 'Değerlendirme'][week - 1]}`} />
                {pending ? (
                  <Text variant="caption" tone="muted">
                    Bu hafta {formatShort(pending.preparedOn)} günü, önceki haftanın performansına göre hazırlanır.
                  </Text>
                ) : (
                  <Card padded={false} style={{ paddingHorizontal: 16 }}>
                    {days.map((d, i) => (
                      <ListRow
                        key={d.dayNumber}
                        icon={d.kind === 'TRAINING' ? (d.doneMain === d.plannedMain && d.plannedMain > 0 ? 'checkmark-circle' : 'barbell-outline') : 'moon-outline'}
                        title={`${formatShort(d.date)} · ${d.title}${d.isToday ? ' (bugün)' : ''}`}
                        subtitle={d.kind === 'TRAINING' ? `~${d.estimatedMinutes} dk · tahmini ~${d.estimatedKcal} kcal · ${d.doneMain}/${d.plannedMain} hareket` : 'İsteğe bağlı hafif hareket'}
                        onPress={() => router.push(`/plan-day/${overview.id}/${d.dayNumber}`)}
                        last={i === days.length - 1}
                      />
                    ))}
                  </Card>
                )}
              </View>
            );
          })}
          <Card variant="soft" style={{ marginTop: 12 }}>
            <Text variant="bodyStrong">Enerji tahmini</Text>
            <Text variant="caption" tone="secondary">
              Günlük ihtiyacın yaklaşık {overview.energy.tdee} kcal (bazal {overview.energy.bmr} kcal). {overview.disclaimer}
            </Text>
          </Card>
          <Button label="Gelişim raporu" variant="secondary" block onPress={() => router.push(`/plan-report/${overview.id}`)} style={{ marginTop: 12 }} />
        </>
      ) : null}

      {/* ── Dönem bitti ── */}
      {cur && ended && cur.instance ? (
        <>
          <Notice
            kind={cur.phase === 'COMPLETED' ? 'success' : 'info'}
            title={cur.phase === 'COMPLETED' ? 'Programı tamamladın' : 'Programın süresi doldu'}
            text={`${cur.instance.progress.completedDays}/${cur.instance.progress.trainingDays} antrenman günü tamamlandı. Gelişim raporun hazır.`}
          />
          <Button label="Gelişim raporunu gör" block onPress={() => router.push(`/plan-report/${cur.instance!.id}`)} />
        </>
      ) : null}

      {/* ── Tanıtım / yeni dönem ── */}
      {cur && !cur.purchase && (!cur.instance || cur.awaitingRepurchase) ? (
        <>
          {!cur.instance ? (
            <Card variant="soft">
              <Text variant="heading" style={{ marginBottom: 6 }}>
                Sana özel 28 günlük program
              </Text>
              <Text variant="body" tone="secondary">
                Hedefine, seviyene, ortamına ve zamanına göre hazırlanır. Her hafta performansına göre güncellenir; her hafta daha zor olmak zorunda değildir.
              </Text>
            </Card>
          ) : (
            <Notice kind="info" text="Yeni bir dönem için güncel ölçülerin ve hedeflerin yeniden alınır. Yeni program eskisinin kopyası olmaz; önceki performansın dikkate alınır." />
          )}
          <SectionHeader title="Nasıl çalışır" />
          <Card>
            {[
              'Tek seferlik satın alma; otomatik yenilenmez.',
              'Süre 28 takvim günüdür. Başlangıç tarihini satın aldıktan sonra 14 gün içinde seçersin.',
              'Başladıktan sonra duraklatılamaz; kaçırdığın antrenman sonraki güne yığılmaz.',
              'Ağrı ya da riskli bir sağlık durumunda otomatik program hazırlanmaz, uzmana yönlendirilirsin.',
              'Tahmini değerler (kalori vb.) ölçüm ya da sonuç garantisi değildir.',
            ].map((t) => (
              <Text key={t} variant="body" style={{ marginBottom: 6 }}>
                • {t}
              </Text>
            ))}
          </Card>
          {catalog ? (
            <>
              <SectionHeader title="Egzersiz alanları" />
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {catalog.categories.map((c, i) => (
                  <ListRow key={c.id} icon="albums-outline" title={c.title} subtitle={c.moves > 0 ? `${c.moves} hareket` : 'İçerik yakında'} last={i === catalog.categories.length - 1} />
                ))}
              </Card>
              <Notice kind="info" title={catalog.price.label} text="Ödeme henüz aktif değil. Şimdilik satın alma bir deneme olarak kaydedilir; gerçek ücret alınmaz." />
            </>
          ) : null}
          {cur.intake && !cur.intake.eligible ? (
            <Notice kind="warning" title="Otomatik program hazırlanamıyor" text={`${cur.intake.reasons.join(' ')} Bir uzmana danışmanı öneririz.`} />
          ) : null}
          {cur.intake?.eligible && cur.canPurchase ? (
            <>
              <Notice kind="success" text="Formun hazır. Güncel bilgilerinle devam edebilirsin." />
              <Button label={busy ? 'İşleniyor…' : 'Satın al (deneme)'} block onPress={buy} disabled={busy} />
              <Button label="Formu güncelle" variant="ghost" block onPress={() => router.push('/plan-intake')} style={{ marginTop: 6 }} />
            </>
          ) : (
            <Button label={cur.intake ? 'Formu yeniden doldur' : 'Formu doldur'} block onPress={() => router.push('/plan-intake')} />
          )}
        </>
      ) : null}
      {!cur && !error ? <EmptyState icon="barbell-outline" title="Yükleniyor" /> : null}
    </Screen>
  );
}
