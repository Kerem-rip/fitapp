// Şifremi unuttum: önce e-posta, sonra e-postaya gelen 6 haneli kod ve yeni şifre.
// Hesabın olup olmadığı söylenmez (her durumda "kod gönderdik" denir). Şifre değişince bütün cihazlardaki oturumlar kapanır.
import { Button, Card, Notice, Screen, ScreenHeader, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

const COOLDOWN_SEC = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ttl, setTtl] = useState(10);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setError('Geçerli bir e-posta adresi yaz.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.forgotPassword(email.trim());
      setDevCode(res.devCode ?? null);
      setTtl(res.codeTtlMinutes);
      setCooldown(COOLDOWN_SEC);
      setStep('code');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError('6 haneli kodu yaz.');
    if (password.length < 8) return setError('Yeni şifre en az 8 karakter olmalı.');
    if (password !== password2) return setError('Şifreler aynı değil.');
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(email.trim(), code, password);
      showToast('Şifren değişti. Yeni şifrenle giriş yapabilirsin.', 'success');
      router.replace('/login');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <Screen>
        <ScreenHeader title="Şifremi unuttum" subtitle="Yeni şifre belirle" onBack={() => router.back()} />
        <Text variant="body" tone="secondary" style={{ marginBottom: 16 }}>
          Hesabının e-posta adresini yaz. Bu adrese bir kod göndereceğiz; kodla yeni şifreni belirleyeceksin.
        </Text>
        {error ? <Notice kind="danger" text={error} /> : null}
        <TextField label="E-posta" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" onSubmitEditing={send} />
        <Button label={busy ? 'Gönderiliyor...' : 'Kod gönder'} size="lg" block disabled={busy} onPress={send} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Yeni şifre" subtitle={email.trim()} onBack={() => setStep('email')} />
      <Text variant="body" tone="secondary" style={{ marginBottom: 16 }}>
        Bu adres bir hesaba kayıtlıysa 6 haneli bir kod gönderdik. Kod {ttl} dakika geçerlidir.
      </Text>

      {devCode ? (
        <Card variant="outline" style={{ marginBottom: 16 }}>
          <Text variant="caption" tone="muted" style={{ fontWeight: '700' }}>
            TEST MODU
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            Gerçek e-posta henüz bağlı değil. Kodun:
          </Text>
          <Pressable onPress={() => setCode(devCode)}>
            <Text variant="title" tone="accent" style={{ letterSpacing: 6, marginTop: 4 }}>
              {devCode}
            </Text>
            <Text variant="micro" tone="muted">
              Dokununca kutuya yazılır
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {error ? <Notice kind="danger" text={error} /> : null}
      <TextField label="Kod" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} icon="key-outline" keyboardType="number-pad" />
      <TextField label="Yeni şifre" value={password} onChangeText={setPassword} icon="lock-closed-outline" secure hint="En az 8 karakter" />
      <TextField label="Yeni şifre (tekrar)" value={password2} onChangeText={setPassword2} icon="lock-closed-outline" secure onSubmitEditing={submit} />
      <Button label={busy ? 'Kaydediliyor...' : 'Şifreyi değiştir'} size="lg" block disabled={busy} onPress={submit} />
      <Notice kind="info" text="Şifren değişince bütün cihazlardaki oturumların kapanır; yeni şifrenle tekrar giriş yaparsın." />

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Pressable onPress={send} disabled={cooldown > 0 || busy} hitSlop={8}>
          <Text variant="bodyStrong" tone={cooldown > 0 ? 'muted' : 'accent'}>
            {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
