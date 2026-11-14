// Bildirim ayarları: hangi sosyal olaylar bildirilsin, sessiz saatler ve anlık bildirim izni.
import type { NotificationPreferences } from '@fitapp/api-client';
import { Card, Notice, Screen, ScreenHeader, SectionHeader, showToast, SwitchRow, Text } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';

const HOURS = [21, 22, 23, 0, 1].map((h) => ({ key: String(h), label: `${String(h).padStart(2, '0')}:00` }));
const WAKE = [6, 7, 8, 9, 10].map((h) => ({ key: String(h), label: `${String(h).padStart(2, '0')}:00` }));

export function NotificationSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    api
      .notificationPreferences()
      .then(setPrefs)
      .catch((e) => showToast(errorText(e), 'warning'));
  }, []);

  const save = (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    api
      .setNotificationPreferences(patch)
      .then(setPrefs)
      .catch((e) => {
        setPrefs(before);
        showToast(errorText(e), 'warning');
      });
  };

  const quiet = prefs ? prefs.quietFrom !== null && prefs.quietTo !== null : false;
  return (
    <Screen>
      <ScreenHeader title="Bildirim ayarları" onBack={() => (router.canGoBack() ? router.back() : router.replace('/notifications'))} />
      {prefs ? (
        <>
          <SectionHeader title="Sosyal bildirimler" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <SwitchRow icon="person-add-outline" title="Takip ve takip istekleri" value={prefs.follows} onChange={(v) => save({ follows: v })} />
            <SwitchRow icon="heart-outline" title="Beğeniler" value={prefs.likes} onChange={(v) => save({ likes: v })} />
            <SwitchRow icon="chatbubble-outline" title="Yorum ve yanıtlar" value={prefs.comments} onChange={(v) => save({ comments: v })} />
            <SwitchRow icon="at-outline" title="Bahsetmeler" value={prefs.mentions} onChange={(v) => save({ mentions: v })} />
            <SwitchRow icon="aperture-outline" title="Hikâye tepki ve yanıtları" value={prefs.stories} onChange={(v) => save({ stories: v })} />
            <SwitchRow icon="paper-plane-outline" title="Mesajlar" description="Anlık bildirim için; mesaj sayısı her zaman görünür." value={prefs.messages} onChange={(v) => save({ messages: v })} last />
          </Card>
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
            Randevu, plan ve danışanlık bildirimleri ayrı merkezdedir ve buradan kapatılmaz.
          </Text>

          <SectionHeader title="Anlık bildirim" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <SwitchRow
              icon="phone-portrait-outline"
              title="Telefonuma bildirim gönder"
              description="İznin olmadan gönderilmez. Kilit ekranında kişi adı, mesaj içeriği ve sağlık bilgisi görünmez."
              value={prefs.pushEnabled}
              onChange={(v) => save({ pushEnabled: v })}
            />
            <SwitchRow
              icon="moon-outline"
              title="Sessiz saatler"
              description="Bu saatlerde telefonuna bildirim gelmez; bildirimler listede birikir."
              value={quiet}
              onChange={(v) => save(v ? { quietFrom: 23, quietTo: 7 } : { quietFrom: null, quietTo: null })}
              last
            />
          </Card>
          {quiet ? (
            <View style={{ marginTop: 8 }}>
              <Text variant="caption" tone="secondary" style={{ marginBottom: 6 }}>
                Başlangıç
              </Text>
              <ChipRow options={HOURS} selected={[String(prefs.quietFrom)]} onToggle={(h) => save({ quietFrom: Number(h), quietTo: prefs.quietTo })} />
              <Text variant="caption" tone="secondary" style={{ marginTop: 10, marginBottom: 6 }}>
                Bitiş
              </Text>
              <ChipRow options={WAKE} selected={[String(prefs.quietTo)]} onToggle={(h) => save({ quietFrom: prefs.quietFrom, quietTo: Number(h) })} />
            </View>
          ) : null}
          <Notice kind="info" text="Telefon bildirimleri uygulama mağaza sürümüyle birlikte etkinleşecek; tercihlerin şimdiden kaydedilir." />
        </>
      ) : null}
    </Screen>
  );
}
