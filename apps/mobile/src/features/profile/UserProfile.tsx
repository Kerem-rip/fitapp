// Profilim (bireysel ve genç kullanıcı): profil, sağlık bilgileri, gizlilik, KVKK izinleri, danışan paylaşımı.
import {
  ALLERGEN_LABELS_TR,
  ALLERGENS,
  type ActivityLevel,
  type Allergen,
  type DietPreference,
} from '@fitapp/shared';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  showToast,
  SwitchRow,
  Tag,
  Text,
  TextField,
} from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AccountSection } from '@/components/AccountSection';
import { ChipRow } from '@/components/ChipRow';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { errorText, saveProfile, setConsentRemote, setPrivateRemote } from '@/auth/actions';
import { DEMO_TOOLS } from '@/config/features';
import { endClientLink, setSharing, simulateParentalApproval, updateHealth } from '@/demo/actions';
import { useAccount, useDemoState, useUserData } from '@/demo/hooks';
import { ACTIVITY_LABELS, DIET_LABELS, ROLE_LABELS } from '@/demo/labels';
import { fullName, proByAccount } from '@/demo/selectors';

const num = (text: string) => Number(text.replace(',', '.'));

export function UserProfile() {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  const state = useDemoState();
  const [editOpen, setEditOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [endTarget, setEndTarget] = useState<string | null>(null);

  // Profil düzenleme alanları
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [editError, setEditError] = useState<string | undefined>();

  // Sağlık bilgisi alanları
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [diet, setDiet] = useState<DietPreference>('none');
  const [allergens, setAllergens] = useState<Allergen[]>([]);

  if (!account) return null;
  const teen = account.roleKey === 'teen';

  const openEdit = () => {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setUsername(account.username);
    setBio(account.bio);
    setEditError(undefined);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await saveProfile({ firstName: firstName.trim(), lastName: lastName.trim(), username: username.trim().toLowerCase(), bio: bio.trim() });
      setEditOpen(false);
      showToast('Profilin güncellendi');
    } catch (e) {
      setEditError(errorText(e));
    }
  };

  const openHealth = () => {
    setHeight(String(data.heightCm));
    setWeight(String(data.weightKg));
    setActivity(data.activity);
    setDiet(data.diet);
    setAllergens(data.allergens);
    setHealthOpen(true);
  };

  const saveHealth = () => {
    if (!data.consents.health_data) {
      showToast('Önce sağlık verisi iznini ver', 'warning');
      return;
    }
    const h = num(height);
    const w = num(weight);
    if (!(h >= 120 && h <= 230) || !(w >= 30 && w <= 300)) {
      showToast('Boy ve kilo değerlerini kontrol et', 'warning');
      return;
    }
    updateHealth(account.id, { heightCm: h, weightKg: w, activity, diet, allergens });
    setHealthOpen(false);
    showToast('Sağlık bilgilerin güncellendi');
  };

  // Bu kullanıcının danışanı olduğu uzmanlar
  const links = state.shared.clientLinks.filter(
    (l) => l.status === 'active' && state.shared.clients[l.clientId]?.accountId === account.id,
  );

  const privacyToggle = (value: boolean) => {
    setPrivateRemote(value).catch((e) => showToast(errorText(e), 'warning'));
  };

  const consentToggle = (key: 'health_data' | 'marketing', value: boolean) => {
    setConsentRemote(key, value)
      .then(() => {
        if (key === 'health_data') showToast(value ? 'Sağlık verisi izni verildi' : 'Sağlık verisi izni geri çekildi', 'info');
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  };

  const endLink = links.find((l) => l.id === endTarget);
  const endPro = endLink ? state.accounts.find((a) => a.id === endLink.proId) : undefined;

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Profil" subtitle={ROLE_LABELS[account.roleKey]} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={fullName(account)} size={72} story />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text variant="title">{fullName(account)}</Text>
            <Text variant="caption" tone="secondary">
              @{account.username}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <Tag label={data.isPrivate ? 'Gizli hesap' : 'Açık hesap'} kind={data.isPrivate ? 'neutral' : 'accent'} icon={data.isPrivate ? 'lock-closed' : 'earth'} />
              {teen ? <Tag label="Genç modu" kind="accent" /> : null}
            </View>
          </View>
        </View>
        <Text variant="body" tone={account.bio ? 'primary' : 'muted'} style={{ marginTop: 12 }}>
          {account.bio || 'Kendini kısaca tanıt.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label="Düzenle" variant="secondary" block icon="create-outline" onPress={openEdit} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Başkaları nasıl görür" variant="ghost" block onPress={() => router.push('/preview')} />
          </View>
        </View>
      </Card>

      {teen ? (
        <Card variant="soft">
          <Text variant="heading" style={{ marginBottom: 4 }}>
            Veli onayı
          </Text>
          <Text variant="body" tone="secondary">
            {data.parentalApproval === 'approved'
              ? 'Velin onayladı. Sağlık verisi kaydı ve uzmanlara mesaj açık.'
              : data.parentalApproval === 'requested'
                ? 'Veli onayı bekleniyor. Onay gelene kadar öğün kaydı ve uzmanlara mesaj kapalı.'
                : 'Henüz veli onayı istenmedi.'}
          </Text>
          {DEMO_TOOLS && data.parentalApproval !== 'approved' ? (
            <Button
              label="Demo: velim onayladı"
              variant="secondary"
              size="sm"
              onPress={() => {
                simulateParentalApproval(account.id);
                showToast('Veli onayı verildi', 'info');
              }}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title="Sağlık bilgilerim" action="Düzenle" onAction={openHealth} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="resize-outline" title="Boy" trailing={<Text variant="bodyStrong">{data.heightCm} cm</Text>} />
        <ListRow icon="scale-outline" title="Kilo" trailing={<Text variant="bodyStrong">{data.weightKg.toLocaleString('tr-TR')} kg</Text>} />
        <ListRow icon="walk-outline" title="Hareket düzeyi" trailing={<Text variant="bodyStrong">{ACTIVITY_LABELS[data.activity]}</Text>} />
        <ListRow icon="leaf-outline" title="Beslenme tercihi" trailing={<Text variant="bodyStrong">{DIET_LABELS[data.diet]}</Text>} />
        <ListRow
          icon="warning-outline"
          title="Alerjiler"
          trailing={
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 190 }}>
              {data.allergens.length ? data.allergens.map((a) => <Tag key={a} label={ALLERGEN_LABELS_TR[a]} kind="danger" />) : <Text variant="caption" tone="muted">Yok</Text>}
            </View>
          }
          last
        />
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
        Sağlık bilgilerin sadece senin izin verdiğin uzmana görünür.
      </Text>

      <SectionHeader title="Gizlilik ve izinler" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <SwitchRow
          icon="lock-closed-outline"
          title="Gizli hesap"
          description={teen ? 'Genç modunda profil her zaman gizlidir.' : 'Takip etmek için onayın gerekir.'}
          value={data.isPrivate}
          onChange={privacyToggle}
        />
        <SwitchRow
          icon="medkit-outline"
          title="Sağlık verisi izni (KVKK)"
          description={teen ? 'Bu izin velin tarafından verilir.' : 'Kilo, boy ve öğün kayıtlarının işlenmesine açık rıza.'}
          value={data.consents.health_data}
          onChange={(v) => consentToggle('health_data', v)}
        />
        <SwitchRow
          icon="mail-outline"
          title="Tanıtım iletileri"
          description="Kampanya ve haber iletileri."
          value={data.consents.marketing}
          onChange={(v) => consentToggle('marketing', v)}
          last
        />
      </Card>

      <SectionHeader title="Paylaşım ve erişim" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow
          icon="shield-checkmark-outline"
          title="Uzmanlara ne paylaştığım"
          subtitle="Gelen teklifler, paylaşım ayarları ve verine kimin baktığı"
          onPress={() => router.push('/sharing')}
          last
        />
      </Card>

      {DEMO_TOOLS && links.length > 0 ? (
        <>
          <SectionHeader title="Uzmanıma paylaştıklarım (demo)" />
          <Notice kind="info" text="Danışanı olduğun uzman sadece burada açtığın verileri görür. İstediğin zaman kapatabilirsin." />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <SwitchRow title="Öğün kayıtlarım" value={data.sharing.meals} onChange={(v) => setSharing(account.id, 'meals', v)} />
            <SwitchRow title="Kilo takibim" value={data.sharing.weight} onChange={(v) => setSharing(account.id, 'weight', v)} />
            <SwitchRow title="Vücut ölçülerim" value={data.sharing.measurements} onChange={(v) => setSharing(account.id, 'measurements', v)} />
            <SwitchRow title="İlerleme fotoğraflarım" value={data.sharing.photos} onChange={(v) => setSharing(account.id, 'photos', v)} last />
          </Card>
          <Card padded={false} style={{ paddingHorizontal: 16, marginTop: 12 }}>
            {links.map((l, i) => {
              const proAccount = state.accounts.find((a) => a.id === l.proId);
              const pro = proByAccount(l.proId);
              return (
                <ListRow
                  key={l.id}
                  avatar={proAccount ? fullName(proAccount) : 'Uzman'}
                  title={pro?.name ?? (proAccount ? fullName(proAccount) : 'Uzman')}
                  subtitle="Danışan bağlantısı aktif"
                  trailing={<Button label="Sonlandır" variant="danger" size="sm" onPress={() => setEndTarget(l.id)} />}
                  last={i === links.length - 1}
                />
              );
            })}
          </Card>
        </>
      ) : null}

      <AccountSection />

      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Profili düzenle">
        <TextField label="Ad" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <TextField label="Soyad" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <TextField label="Kullanıcı adı" value={username} onChangeText={(t) => { setUsername(t); setEditError(undefined); }} error={editError} />
        <TextField label="Hakkında" value={bio} onChangeText={setBio} multiline maxLength={200} />
        <Button label="Kaydet" size="lg" block onPress={saveEdit} style={{ marginBottom: 8 }} />
      </BottomSheet>

      <BottomSheet visible={healthOpen} onClose={() => setHealthOpen(false)} title="Sağlık bilgilerim">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Boy (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Kilo (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          </View>
        </View>
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Hareket düzeyi
        </Text>
        <ChipRow wrap options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((key) => ({ key, label: ACTIVITY_LABELS[key] }))} selected={[activity]} onToggle={setActivity} />
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Beslenme tercihi
        </Text>
        <ChipRow wrap options={(Object.keys(DIET_LABELS) as DietPreference[]).map((key) => ({ key, label: DIET_LABELS[key] }))} selected={[diet]} onToggle={setDiet} />
        <Text variant="caption" tone="secondary" style={{ marginBottom: 8, fontWeight: '600' }}>
          Alerjiler
        </Text>
        <ChipRow
          wrap
          options={ALLERGENS.map((key) => ({ key, label: ALLERGEN_LABELS_TR[key] }))}
          selected={allergens}
          onToggle={(a) => setAllergens((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]))}
        />
        <Button label="Kaydet" size="lg" block onPress={saveHealth} style={{ marginBottom: 8 }} />
      </BottomSheet>

      <ConfirmSheet
        visible={endTarget !== null}
        title="Danışanlığı sonlandır"
        text={`${endPro ? fullName(endPro) : 'Uzman'} artık verilerine erişemez. İstersen sonra tekrar danışan olabilirsin.`}
        confirmLabel="Sonlandır"
        danger
        onConfirm={() => {
          if (endTarget) endClientLink(endTarget);
          showToast('Danışan bağlantısı sonlandırıldı', 'info');
        }}
        onClose={() => setEndTarget(null)}
      />
    </Screen>
  );
}
