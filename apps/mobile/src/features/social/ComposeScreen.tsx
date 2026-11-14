// Gönderi oluştur: metin, en fazla 5 fotoğraf/video (video en fazla 30 sn) ve (istenirse) alıntılanan gönderi.
// Fotoğraflar seçilince yüklenir; konum bilgisi sunucuda silinir. Paylaş'a basılınca gönderi oluşur.
import type { PostView, UploadFile } from '@fitapp/api-client';
import { Button, Icon, Notice, Screen, ScreenHeader, showToast, Text, TextField, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

const MAX_MEDIA = 5;
const MAX_TEXT = 2200;

type Picked = { localUri: string; id: string | null; video?: boolean; failed?: boolean };

const MAX_VIDEO_MS = 30_000;

export function ComposeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { quote } = useLocalSearchParams<{ quote?: string }>();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<Picked[]>([]);
  const [quoted, setQuoted] = useState<PostView | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!quote) return;
    api
      .post(quote)
      .then(setQuoted)
      .catch(() => showToast('Alıntılanacak gönderi bulunamadı', 'warning'));
  }, [quote]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const uploading = media.some((m) => m.id === null && !m.failed);

  const pick = async () => {
    const room = MAX_MEDIA - media.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.8, videoMaxDuration: 30 });
    if (res.canceled) return;
    // 30 saniyeden uzun videolar eklenmez
    const tooLong = res.assets.filter((a) => a.type === 'video' && (a.duration ?? 0) > MAX_VIDEO_MS + 500);
    if (tooLong.length) showToast('Video en fazla 30 saniye olabilir.', 'warning');
    const assets = res.assets.filter((a) => !tooLong.includes(a)).slice(0, room);
    const added: Picked[] = assets.map((a) => ({ localUri: a.uri, id: null, video: a.type === 'video' }));
    setMedia((prev) => [...prev, ...added]);
    for (const a of assets) {
      const mime = a.type === 'video' ? (a.mimeType === 'video/quicktime' ? 'video/quicktime' : 'video/mp4') : a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/mp4' ? 'mp4' : mime === 'image/png' ? 'png' : 'jpg';
      const file: UploadFile = { uri: a.uri, name: a.fileName ?? `gonderi.${ext}`, mimeType: mime, file: a.file };
      try {
        const r = await api.uploadPostMedia(file);
        setMedia((prev) => prev.map((m) => (m.localUri === a.uri ? { ...m, id: r.id } : m)));
      } catch (e) {
        setMedia((prev) => prev.map((m) => (m.localUri === a.uri ? { ...m, failed: true } : m)));
        showToast(errorText(e), 'warning');
      }
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const post = await api.createPost({
        text: text.trim() || null,
        mediaIds: media.filter((m) => m.id).map((m) => m.id!),
        quotedPostId: quoted?.id ?? null,
      });
      showToast('Paylaşıldı');
      router.replace(`/post/${post.id}`);
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const ready = (text.trim().length > 0 || media.some((m) => m.id)) && !uploading && !busy;

  return (
    <Screen>
      <ScreenHeader title={quoted ? 'Alıntıla' : 'Yeni gönderi'} onBack={back} />
      <TextField
        value={text}
        onChangeText={setText}
        placeholder="Ne paylaşmak istersin? #etiket ve @kullanıcı ekleyebilirsin"
        multiline
        maxLength={MAX_TEXT}
        autoCapitalize="sentences"
        hint={`${text.length}/${MAX_TEXT}`}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {media.map((m) => (
          <View key={m.localUri} style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
            {m.video ? (
              <View style={{ width: 96, height: 96, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', opacity: m.id ? 1 : 0.5 }}>
                <Icon name="videocam" size={28} color="#FFFFFF" />
              </View>
            ) : (
              <Image source={{ uri: m.localUri }} style={{ width: 96, height: 96, opacity: m.id ? 1 : 0.5 }} contentFit="cover" />
            )}
            {m.failed ? (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="alert-circle" size={24} color={c.danger} />
              </View>
            ) : null}
            <Pressable
              onPress={() => setMedia((prev) => prev.filter((x) => x.localUri !== m.localUri))}
              accessibilityRole="button"
              accessibilityLabel="Çıkar"
              style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 2 }}
            >
              <Icon name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {media.length < MAX_MEDIA ? (
          <Pressable
            onPress={pick}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf ya da video ekle"
            style={{ width: 96, height: 96, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="images-outline" size={26} color={c.textMuted} />
            <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
              {media.length}/{MAX_MEDIA}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {quoted ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 12 }}>
          <Text variant="caption" tone="secondary">
            {quoted.author.displayName} · @{quoted.author.username}
          </Text>
          {quoted.text ? (
            <Text variant="body" numberOfLines={3} style={{ marginTop: 4 }}>
              {quoted.text}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Notice kind="info" text="Fotoğraf ve videolardaki konum ve cihaz bilgisi paylaşılmadan önce silinir. Video en fazla 30 saniye. Sağlık raporu, tahlil gibi kişisel belgeleri paylaşma." />
      <Button label={uploading ? 'Yükleniyor…' : 'Paylaş'} block onPress={submit} disabled={!ready} />
    </Screen>
  );
}
