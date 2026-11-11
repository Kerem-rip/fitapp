// Kayıt: e-posta, kullanıcı adı, doğum tarihi ve KVKK rızaları.
// Kurallar backend ile aynıdır (packages/shared): 13 yaş altı kayıt olamaz, 13–17 genç modu.
import { Button, Chip, Notice, Row, Screen, ScreenHeader, SwitchRow, TextField, Text, Card } from '@fitapp/ui-mobile';
import { ageGroupOf, parseTrDate, type Sex } from '@fitapp/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { register, type RegisterErrors } from '@/demo/actions';
import { SEX_LABELS } from '@/demo/labels';

export default function RegisterScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  const group = useMemo(() => {
    const date = parseTrDate(birthDate);
    return date ? ageGroupOf(date) : null;
  }, [birthDate]);

  const submit = () => {
    const result = register({ firstName, lastName, email, username, birthDate, password, sex, acceptTerms, healthConsent });
    if (!result.ok) setErrors(result.errors);
    // Başarılıysa giriş yapılmış olur ve uygulama hesabın paneline kendiliğinden geçer
  };

  return (
    <Screen>
      <ScreenHeader title="Hesap oluştur" subtitle="Birkaç bilgi yeterli" onBack={() => router.back()} />

      {errors.general ? <Notice kind="danger" text={errors.general} /> : null}

      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Ad" value={firstName} onChangeText={setFirstName} autoCapitalize="words" error={errors.firstName} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Soyad" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        </View>
      </Row>
      <TextField label="E-posta" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" error={errors.email} />
      <TextField
        label="Kullanıcı adı"
        value={username}
        onChangeText={setUsername}
        icon="at"
        hint="Harf, rakam, nokta ve alt çizgi kullanabilirsin"
        error={errors.username}
      />
      <TextField
        label="Doğum tarihi"
        value={birthDate}
        onChangeText={setBirthDate}
        icon="calendar-outline"
        placeholder="GG.AA.YYYY"
        keyboardType="numbers-and-punctuation"
        error={errors.birthDate}
      />
      {group === 'TEEN' ? (
        <Notice
          kind="info"
          title="Genç modu"
          text="13-17 yaş arası kullanıcılar için kalori sayımı ve kilo hedefi kapalıdır, profil gizlidir. Uzmanlara ulaşmak ve sağlık verisi için veli onayı gerekir."
        />
      ) : null}
      {group === 'CHILD' ? <Notice kind="danger" text="13 yaşından küçükler kayıt olamaz." /> : null}
      <TextField label="Şifre" value={password} onChangeText={setPassword} secure icon="lock-closed-outline" hint="En az 8 karakter" error={errors.password} />

      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Cinsiyet (kalori hesabı için)
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {(Object.keys(SEX_LABELS) as Sex[]).map((key) => (
          <Chip key={key} label={SEX_LABELS[key]} selected={sex === key} onPress={() => setSex(key)} />
        ))}
      </Row>

      <Card>
        <SwitchRow
          title="Kullanım koşulları ve aydınlatma metni"
          description="Kullanım koşullarını ve KVKK aydınlatma metnini okudum, kabul ediyorum."
          value={acceptTerms}
          onChange={setAcceptTerms}
        />
        <SwitchRow
          title="Sağlık verisi için açık rıza"
          description="Kilo, boy ve öğün kayıtlarımın işlenmesine izin veriyorum. İsteğe bağlıdır; Profil bölümünden değiştirebilirsin."
          value={healthConsent && group !== 'TEEN'}
          onChange={(v) => setHealthConsent(group === 'TEEN' ? false : v)}
          last
        />
        {errors.acceptTerms ? (
          <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
            {errors.acceptTerms}
          </Text>
        ) : null}
        <Text variant="micro" tone="muted" style={{ marginTop: 8 }}>
          Hukuki metinler taslaktır; yayın öncesi bir hukukçu tarafından hazırlanacaktır.
        </Text>
      </Card>

      <Button label="Hesabı oluştur" size="lg" block onPress={submit} style={{ marginTop: 4 }} />
    </Screen>
  );
}
