// Profili düzenle: fotoğraf, görünen ad, kullanıcı adı, biyografi, şehir, spor hedefleri, ilgi alanları, bağlantılar.
// Kullanıcı adı benzersizdir; değiştirmek için bekleme süresi yoktur. Fotoğraftaki konum gibi gizli bilgiler sunucuda silinir.
import type { ProfileLink, SportRef, UploadFile } from '@fitapp/api-client';
import { Button, Chip, IconButton, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text, TextField } from '@fitapp/ui-mobile';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/api/client';
import { errorText, refreshMe } from '@/auth/actions';
import { useAuth } from '@/auth/auth-store';
import { UserAvatar } from '@/components/social/UserAvatar';

export default function ProfileEditScreen() {
  const router = useRouter();
  const me = useAuth().me;
  const [displayName, setDisplayName] = useState(me?.customDisplayName ?? '');
  const [username, setUsername] = useState(me?.username ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [city, setCity] = useState(me?.city ?? '');
  const [goals, setGoals] = useState(me?.goals ?? '');
  const [sports, setSports] = useState<string[]>(me?.sports.map((s) => s.id) ?? []);
  const [links, setLinks] = useState<ProfileLink[]>(me?.links ?? []);
  const [allSports, setAllSports] = useState<SportRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    api
      .socialSports()
      .then(setAllSports)
      .catch(() => setAllSports([]));
  }, []);

  if (!me) return null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const file: UploadFile = { uri: asset.uri, name: asset.fileName ?? `profil.${mime === 'image/png' ? 'png' : 'jpg'}`, mimeType: mime, file: asset.file };
    setPhotoBusy(true);
    try {
      await api.uploadAvatar(file);
      await refreshMe();
      showToast('Profil fotoğrafın güncellendi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.removeAvatar();
      await refreshMe();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    const cleanLinks = links.filter((l) => l.label.trim() || l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
    if (cleanLinks.some((l) => !l.label || !/^https?:\/\/\S+$/i.test(l.url))) return setError('Her bağlantının bir adı olmalı ve adresi http:// ya da https:// ile başlamalı.');
    setBusy(true);
    setError(null);
    try {
      await api.updateMe({
        displayName: displayName.trim() || null,
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        goals: goals.trim() || null,
        sports,
        links: cleanLinks,
      });
      await refreshMe();
      showToast('Profilin güncellendi');
      back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Profili düzenle" onBack={back} />
      <View style={{ alignItems: 'center', marginBottom: 16, gap: 10 }}>
        <UserAvatar name={me.displayName} url={me.avatarUrl} size={96} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label={photoBusy ? 'Yükleniyor...' : me.avatarUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'} size="sm" variant="secondary" disabled={photoBusy} onPress={pickPhoto} />
          {me.avatarUrl ? <Button label="Kaldır" size="sm" variant="ghost" disabled={photoBusy} onPress={removePhoto} /> : null}
        </View>
      </View>

      {error ? <Notice kind="warning" text={error} /> : null}
      <TextField label="Görünen ad" value={displayName} onChangeText={setDisplayName} maxLength={50} hint="Boş bırakırsan adın ve soyadın görünür." />
      <TextField label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none" icon="at" />
      <TextField label="Biyografi" value={bio} onChangeText={setBio} multiline maxLength={300} />
      <TextField label="Şehir" value={city} onChangeText={setCity} maxLength={60} autoCapitalize="words" />
      <TextField label="Spor hedeflerin" value={goals} onChangeText={setGoals} maxLength={200} placeholder="ör. İlk yarı maratonumu koşmak" />

      <SectionHeader title="İlgi alanların" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {allSports.map((s) => {
          const on = sports.includes(s.id);
          return (
            <Chip
              key={s.id}
              label={s.name}
              selected={on}
              onPress={() => setSports((cur) => (on ? cur.filter((x) => x !== s.id) : cur.length >= 10 ? cur : [...cur, s.id]))}
            />
          );
        })}
      </View>
      <Text variant="micro" tone="muted" style={{ marginBottom: 8 }}>
        En fazla 10 seçebilirsin. Keşfet bölümünde sana benzer ilgi alanlarındaki kişiler önerilir.
      </Text>

      <SectionHeader title="Bağlantılar" action={links.length < 3 ? 'Ekle' : undefined} onAction={() => setLinks((cur) => [...cur, { label: '', url: '' }])} />
      {links.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField label="Ad" value={l.label} onChangeText={(t) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, label: t } : x)))} maxLength={30} />
          </View>
          <View style={{ flex: 2 }}>
            <TextField label="Adres" value={l.url} onChangeText={(t) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, url: t } : x)))} autoCapitalize="none" keyboardType="url" maxLength={200} />
          </View>
          <View style={{ paddingTop: 26 }}>
            <IconButton icon="close" label="Bağlantıyı kaldır" size={36} onPress={() => setLinks((cur) => cur.filter((_, j) => j !== i))} />
          </View>
        </View>
      ))}
      {links.length === 0 ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          Strava, YouTube gibi en fazla 3 bağlantı ekleyebilirsin.
        </Text>
      ) : null}

      <Button label={busy ? 'Kaydediliyor...' : 'Kaydet'} size="lg" block disabled={busy} onPress={save} style={{ marginTop: 12 }} />
    </Screen>
  );
}
