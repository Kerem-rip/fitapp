// Ayarlar ve gizlilik (☰ menüden): hesap bilgileri, "Profilini doldur" (sunucudaki gerçek sağlık bilgileri), gizlilik, KVKK izinleri, danışan paylaşımı.
// Hiçbir bilgi zorunlu değildir ve otomatik soru sorulmaz; isteyen buradan doldurur.
import {
  BottomSheet,
  Button,
  Card,
  ListRow,
  Notice,
  ProgressBar,
  Screen,
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
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { api } from '@/api/client';
import { errorText, refreshMe, saveProfile, setConsentRemote, setPrivateRemote } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { DEMO_TOOLS } from '@/config/features';
import { endClientLink, setSharing, simulateParentalApproval } from '@/demo/actions';
import { useAccount, useDemoState, useUserData } from '@/demo/hooks';
import { fullName, proByAccount } from '@/demo/selectors';
import { useHealthProfile } from '@/features/health/useHealthProfile';

export function UserProfile() {
  const router = useRouter();
  const account = useAccount();
  const data = useUserData();
  const state = useDemoState();
  const health = useHealthProfile();
  const me = useAuth().me;
  const [editOpen, setEditOpen] = useState(false);
  const [endTarget, setEndTarget] = useState<string | null>(null);

  // Profil düzenleme alanları
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [editError, setEditError] = useState<string | undefined>();

  if (!account) return null;
  const teen = account.roleKey === 'teen';

  const openEdit = () => {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setEditError(undefined);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await saveProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      setEditOpen(false);
      showToast('Profilin güncellendi');
    } catch (e) {
      setEditError(errorText(e));
    }
  };

  // Bu kullanıcının danışanı olduğu uzmanlar
  const links = state.shared.clientLinks.filter(
    (l) => l.status === 'active' && state.shared.clients[l.clientId]?.accountId === account.id,
  );

  const privacyToggle = (value: boolean) => {
    setPrivateRemote(value).catch((e) => showToast(errorText(e), 'warning'));
  };

  // Mesaj gizliliği ve çevrimiçi durumu
  const socialSetting = (patch: { dmPolicy?: 'EVERYONE' | 'FOLLOWING'; showActivity?: boolean }) => {
    api
      .updateMe(patch)
      .then(() => refreshMe())
      .catch((e) => showToast(errorText(e), 'warning'));
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
    <Screen>
      <SectionHeader title="Hesap bilgileri" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="person-outline" title="Ad ve soyad" subtitle={fullName(account)} onPress={openEdit} />
        <ListRow icon="at-outline" title="Kullanıcı adı, fotoğraf ve biyografi" subtitle={`@${account.username} · Profil › Profili düzenle`} onPress={() => router.push('/profile-edit')} last />
      </Card>
      {teen ? <Tag label="Genç modu" kind="accent" /> : null}
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

      <SectionHeader title="Profilini doldur" action={health.loaded ? `${health.filled}/${health.total}` : undefined} />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <View style={{ paddingTop: 14 }}>
          <Text variant="caption" tone="secondary">
            İstersen doldur; hiçbiri zorunlu değil. Boy ve kilon kalori tahminini, alerji bilgin yemek uyarılarını iyileştirir.
          </Text>
          {health.loaded ? (
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={health.filled} max={health.total} />
            </View>
          ) : null}
        </View>
        <ListRow
          icon="resize-outline"
          title="Boy"
          trailing={<Text variant={health.height ? 'bodyStrong' : 'caption'} tone={health.height ? undefined : 'muted'}>{health.height ? `${health.height.value.toLocaleString('tr-TR')} cm` : 'Eklenmedi'}</Text>}
          onPress={() => router.push('/my-health')}
        />
        <ListRow
          icon="scale-outline"
          title="Kilo"
          trailing={<Text variant={health.weight ? 'bodyStrong' : 'caption'} tone={health.weight ? undefined : 'muted'}>{health.weight ? `${health.weight.value.toLocaleString('tr-TR')} kg` : 'Eklenmedi'}</Text>}
          onPress={() => router.push('/my-health')}
        />
        <ListRow
          icon="warning-outline"
          title="Alerjiler"
          trailing={<Text variant={health.allergies ? 'bodyStrong' : 'caption'} tone={health.allergies ? undefined : 'muted'} numberOfLines={1} style={{ maxWidth: 190 }}>{health.allergies ?? 'Eklenmedi'}</Text>}
          onPress={() => router.push('/my-health')}
        />
        <ListRow
          icon="leaf-outline"
          title="Beslenme tercihi"
          trailing={<Text variant={health.diet ? 'bodyStrong' : 'caption'} tone={health.diet ? undefined : 'muted'} numberOfLines={1} style={{ maxWidth: 190 }}>{health.diet ?? 'Eklenmedi'}</Text>}
          onPress={() => router.push('/my-health')}
          last
        />
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
        Doldurmak için bir satıra dokun. Sağlık bilgilerin sadece senin izin verdiğin uzmana görünür.
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
        />
        <SwitchRow
          icon="chatbubbles-outline"
          title="Sadece takip ettiklerim mesaj göndersin"
          description="Kapalıyken herkes yazabilir; takip etmediklerin İstekler kutusuna düşer."
          value={me?.dmPolicy === 'FOLLOWING'}
          onChange={(v) => socialSetting({ dmPolicy: v ? 'FOLLOWING' : 'EVERYONE' })}
        />
        <SwitchRow
          icon="radio-button-on-outline"
          title="Çevrimiçi ve son görülme bilgim görünsün"
          description="Kapatırsan başkalarınınkini de göremezsin."
          value={me?.showActivity ?? true}
          onChange={(v) => socialSetting({ showActivity: v })}
        />
        <ListRow icon="ban-outline" title="Engellenenler ve sessize alınanlar" onPress={() => router.push('/blocked')} />
        <ListRow icon="phone-portrait-outline" title="Açık oturumlar" subtitle="Hesabına giriş yapılmış cihazlar" onPress={() => router.push('/sessions')} />
        <ListRow icon="shield-outline" title="Kaldırılan içeriklerim" onPress={() => router.push('/moderation-notices')} last />
      </Card>

      <SectionHeader title="Paylaşım ve erişim" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow
          icon="calendar-outline"
          title="Randevularım ve hedeflerim"
          subtitle="Uzmanlarımla randevular ve belirlenen hedefler"
          onPress={() => router.push('/my-appointments')}
        />
        <ListRow
          icon="barbell-outline"
          title="Antrenman programım"
          subtitle="Antrenörümün onayladığı program ve kayıtlarım"
          onPress={() => router.push('/my-programs')}
        />
        <ListRow
          icon="restaurant-outline"
          title="Beslenme planım"
          subtitle="Diyetisyenimin onayladığı plan ve seçimlerim"
          onPress={() => router.push('/my-plans')}
        />
        <ListRow
          icon="business-outline"
          title="Salon davetlerim"
          subtitle="Bir salonun ekibine katılma davetleri"
          onPress={() => router.push('/gym-invites')}
        />
        <ListRow
          icon="clipboard-outline"
          title="Ölçümlerim ve sağlık öyküm"
          subtitle="Kilo, ölçüler, alerji ve yaşam tarzı bilgilerin"
          onPress={() => router.push('/my-health')}
        />
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

      <BottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Ad ve soyad">
        <TextField label="Ad" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <TextField label="Soyad" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        {editError ? <Notice kind="warning" text={editError} /> : null}
        <Button label="Kaydet" size="lg" block onPress={saveEdit} style={{ marginBottom: 8 }} />
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
