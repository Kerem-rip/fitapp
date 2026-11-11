// E-posta doğrulama: 6 haneli kod girilince hesap açılır ve oturum başlar.
import { Button, Card, Notice, Screen, ScreenHeader, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { completeRegistration, errorText } from '@/auth/actions';
import { patchFlow, setFlow, useFlow } from '@/auth/registration-flow';

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyScreen() {
  const router = useRouter();
  const flow = useFlow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!flow) {
    // Sayfa yenilendiyse geçici bilgiler kaybolur; baştan başlanır
    return (
      <Screen>
        <ScreenHeader title="E-posta doğrulama" onBack={() => router.replace('/')} />
        <Notice kind="warning" text="Kayıt oturumun sona erdi. Lütfen kayıt işlemini baştan başlat." />
        <Button label="Kayıt ol" block onPress={() => router.replace('/register-type')} />
      </Screen>
    );
  }

  const submit = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError('6 haneli kodu yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.registerVerify(flow.registrationId, code.trim());
      setFlow(null);
      // Oturum başlayınca kök düzen hesabı doğru bölüme (uygulama ya da başvuru durumu) yönlendirir
      await completeRegistration(result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      const result = await api.registerResend(flow.registrationId);
      patchFlow({ codeExpiresAt: result.codeExpiresAt, devCode: result.devCode });
      setCooldown(RESEND_COOLDOWN_SEC);
      showToast('Yeni kod gönderildi', 'success');
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Screen>
      <ScreenHeader title="E-postanı doğrula" subtitle={flow.email} onBack={() => router.back()} />

      <Text variant="body" tone="secondary" style={{ marginBottom: 16 }}>
        Adresine 6 haneli bir doğrulama kodu gönderdik. Kod 10 dakika geçerlidir.
      </Text>

      {flow.devCode ? (
        <Card variant="outline" style={{ marginBottom: 16 }}>
          <Text variant="caption" tone="muted" style={{ fontWeight: '700' }}>
            TEST MODU
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            Gerçek e-posta henüz bağlı değil. Kodun:
          </Text>
          <Pressable onPress={() => setCode(flow.devCode!)}>
            <Text variant="title" tone="accent" style={{ letterSpacing: 6, marginTop: 4 }}>
              {flow.devCode}
            </Text>
            <Text variant="micro" tone="muted">
              Dokununca kutuya yazılır
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {error ? <Notice kind="danger" text={error} /> : null}

      <TextField
        label="Doğrulama kodu"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        icon="key-outline"
        keyboardType="number-pad"
        onSubmitEditing={submit}
      />
      <Button label={busy ? 'Doğrulanıyor...' : 'Doğrula'} size="lg" block disabled={busy} onPress={submit} />

      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
          <Text variant="bodyStrong" tone={cooldown > 0 ? 'muted' : 'accent'}>
            {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
