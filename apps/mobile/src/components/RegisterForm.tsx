// Kayıt formu: standart ve profesyonel kayıt aynı çatıyı kullanır; profesyonelde alan bilgileri ve belgeler eklenir.
// Kurallar sunucuyla aynıdır (packages/shared): 13 yaş altı kayıt olamaz, 13–17 genç modu.
import type { DocumentKind, Gender, ProfessionalField } from '@fitapp/api-client';
import { ageGroupOf, parseTrDate, validateEmail, validatePassword, validateUsername, type Sex } from '@fitapp/shared';
import { Button, Card, Chip, Notice, Row, SwitchRow, Text, TextField } from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { setFlow } from '@/auth/registration-flow';
import { useUsernameCheck } from '@/auth/useUsernameCheck';
import { SEX_LABELS } from '@/demo/labels';
import { ChipRow } from './ChipRow';
import { DocumentPicker, type PickedDoc } from './DocumentPicker';

const GENDER: Record<Sex, Gender> = { female: 'FEMALE', male: 'MALE', other: 'OTHER' };

// Alana göre istenen belge türleri (sunucudaki kuralla aynı)
export const FIELD_DOC_KINDS: Record<ProfessionalField, readonly DocumentKind[]> = {
  DIETITIAN: ['diploma'],
  TRAINER: ['diploma', 'certificate'],
  GYM_OWNER: ['business_license'],
};

export const FIELD_LABELS: Record<ProfessionalField, string> = {
  DIETITIAN: 'Diyetisyen',
  TRAINER: 'Bağımsız eğitmen',
  GYM_OWNER: 'Spor salonu sahibi',
};

const SPECIALTIES: Record<'DIETITIAN' | 'TRAINER', string[]> = {
  DIETITIAN: ['Kilo verme', 'Sporcu beslenmesi', 'Çocuk beslenmesi', 'Hamilelik', 'Diyabet', 'Vegan / vejetaryen'],
  TRAINER: ['Kilo verme', 'Kas kazanımı', 'Pilates', 'Yoga', 'Fonksiyonel', 'Postür egzersizleri'],
};

type Errors = Partial<Record<'firstName' | 'email' | 'username' | 'birthDate' | 'password' | 'acceptTerms' | 'city' | 'gymName' | 'docs' | 'general', string>>;

// "GG.AA.YYYY" → "YYYY-AA-GG"
function toIsoDate(text: string): string | null {
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

export function RegisterForm({ field }: { field?: ProfessionalField }) {
  const router = useRouter();
  const professional = field !== undefined;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [gymName, setGymName] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [docs, setDocs] = useState<PickedDoc[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  // Hesap başlatıldı ama belge yüklemesi yarım kaldıysa tekrar başlatmadan devam edilir
  const [pending, setPending] = useState<{ registrationId: string; remaining: PickedDoc[] } | null>(null);

  const usernameCheck = useUsernameCheck(username);
  const group = useMemo(() => {
    const date = parseTrDate(birthDate);
    return date ? ageGroupOf(date) : null;
  }, [birthDate]);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = 'Adını yaz.';
    const emailError = validateEmail(email.trim());
    if (emailError) next.email = emailError;
    const usernameError = validateUsername(username.trim().toLowerCase());
    if (usernameError) next.username = usernameError;
    else if (usernameCheck.status === 'taken') next.username = 'Bu kullanıcı adı alınmış.';
    if (!toIsoDate(birthDate) || !parseTrDate(birthDate)) next.birthDate = 'Doğum tarihini GG.AA.YYYY biçiminde yaz.';
    else if (group === 'CHILD') next.birthDate = '13 yaşından küçükler kayıt olamaz.';
    else if (professional && group === 'TEEN') next.birthDate = 'Profesyonel hesap için 18 yaşını doldurmuş olmalısın.';
    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;
    if (!acceptTerms) next.acceptTerms = 'Devam etmek için kullanım koşullarını kabul etmelisin.';
    if (professional) {
      if (!city.trim()) next.city = 'Şehrini yaz.';
      if (field === 'GYM_OWNER' && !gymName.trim()) next.gymName = 'Salon adını yaz.';
      if (docs.length === 0) next.docs = 'En az bir belge eklemelisin.';
    }
    return next;
  };

  const uploadAll = async (registrationId: string, list: PickedDoc[]): Promise<PickedDoc[]> => {
    const left = [...list];
    while (left.length > 0) {
      const doc = left[0]!;
      await api.uploadRegistrationDocument(registrationId, doc.kind, doc.file);
      left.shift();
      setPending({ registrationId, remaining: [...left] });
    }
    return left;
  };

  const submit = async () => {
    if (busy) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      let registrationId = pending?.registrationId;
      let start: Awaited<ReturnType<typeof api.registerStart>> | null = null;
      if (!registrationId) {
        start = await api.registerStart({
          accountType: professional ? 'PROFESSIONAL' : 'USER',
          email: email.trim(),
          password,
          username: username.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          birthDate: toIsoDate(birthDate)!,
          gender: GENDER[sex],
          acceptTerms: true,
          healthDataConsent: healthConsent && group !== 'TEEN',
          professional: professional
            ? {
                field: field!,
                city: city.trim(),
                specialties: field === 'GYM_OWNER' ? undefined : specialties,
                gymName: field === 'GYM_OWNER' ? gymName.trim() : undefined,
                gymAddress: field === 'GYM_OWNER' ? gymAddress.trim() || undefined : undefined,
              }
            : undefined,
        });
        registrationId = start.registrationId;
        setPending({ registrationId, remaining: docs });
      }
      if (professional) await uploadAll(registrationId, pending?.remaining ?? docs);
      setFlow({
        registrationId,
        email: email.trim(),
        accountType: professional ? 'PROFESSIONAL' : 'USER',
        codeExpiresAt: start?.codeExpiresAt ?? new Date(Date.now() + 10 * 60_000).toISOString(),
        devCode: start?.devCode,
        requiredDocuments: start?.requiredDocuments ?? [],
      });
      router.push('/verify');
    } catch (e) {
      setErrors({ general: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const usernameHint =
    usernameCheck.status === 'checking'
      ? 'Kontrol ediliyor...'
      : usernameCheck.status === 'free'
        ? 'Bu kullanıcı adı boş.'
        : 'Harf, rakam, nokta ve alt çizgi kullanabilirsin';

  return (
    <>
      {errors.general ? <Notice kind="danger" text={errors.general} /> : null}
      {pending && professional ? (
        <Notice kind="warning" text="Hesabın başlatıldı ancak belgeler yüklenemedi. Aşağıdaki düğmeye basarak yüklemeyi yeniden dene." />
      ) : null}

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
        hint={usernameHint}
        error={errors.username ?? (usernameCheck.status === 'taken' || usernameCheck.status === 'invalid' ? usernameCheck.message : undefined)}
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
      {group === 'TEEN' && !professional ? (
        <Notice
          kind="info"
          title="Genç modu"
          text="13-17 yaş arası kullanıcılar için kalori sayımı ve kilo hedefi kapalıdır, profil gizlidir."
        />
      ) : null}
      <TextField label="Şifre" value={password} onChangeText={setPassword} secure icon="lock-closed-outline" hint="En az 8 karakter" error={errors.password} />

      <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
        Cinsiyet
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {(Object.keys(SEX_LABELS) as Sex[]).map((key) => (
          <Chip key={key} label={SEX_LABELS[key]} selected={sex === key} onPress={() => setSex(key)} />
        ))}
      </Row>

      {professional ? (
        <>
          <Text variant="heading" style={{ marginTop: 4, marginBottom: 10 }}>
            {FIELD_LABELS[field!]} bilgileri
          </Text>
          <TextField label="Şehir" value={city} onChangeText={setCity} icon="location-outline" autoCapitalize="words" error={errors.city} />
          {field === 'GYM_OWNER' ? (
            <>
              <TextField label="Salon adı" value={gymName} onChangeText={setGymName} icon="business-outline" autoCapitalize="words" error={errors.gymName} />
              <TextField label="Salon adresi (isteğe bağlı)" value={gymAddress} onChangeText={setGymAddress} icon="map-outline" />
            </>
          ) : (
            <>
              <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
                Uzmanlık alanların (isteğe bağlı)
              </Text>
              <ChipRow
                wrap
                options={SPECIALTIES[field as 'DIETITIAN' | 'TRAINER'].map((s) => ({ key: s, label: s }))}
                selected={specialties}
                onToggle={(s) => setSpecialties((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
              />
            </>
          )}
          <Text variant="heading" style={{ marginTop: 8, marginBottom: 6 }}>
            Belgeler
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginBottom: 10 }}>
            Belgelerin yalnızca onay ekibi tarafından görülür ve her erişim kaydedilir.
          </Text>
          <DocumentPicker docs={docs} onChange={setDocs} kinds={FIELD_DOC_KINDS[field!]} />
          {errors.docs ? (
            <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
              {errors.docs}
            </Text>
          ) : null}
          <View style={{ height: 16 }} />
        </>
      ) : null}

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

      <Button
        label={busy ? 'Gönderiliyor...' : pending && professional ? 'Belgeleri yeniden yükle' : 'Devam et'}
        size="lg"
        block
        disabled={busy}
        onPress={submit}
        style={{ marginTop: 4 }}
      />
    </>
  );
}
