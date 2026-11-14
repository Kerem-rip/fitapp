// Hikâye oluştur: fotoğraf/video (en fazla 30 sn) ya da renkli zeminde yazı; kitle seçimi ve çıkartmalar
// (anket, soru, bahsetme, bağlantı, elle konum, başarı). Hikâye 24 saat görünür, sonra arşive düşer.
import type { StoryAchievement, StoryAudience, StoryBackground, UploadFile } from '@fitapp/api-client';
import { Button, Chip, Icon, Notice, Screen, ScreenHeader, SectionHeader, showToast, Text, TextField, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { ChipRow } from '@/components/ChipRow';
import { AUDIENCES, BACKGROUNDS, backgroundColor } from './story-style';

type Sticker = 'poll' | 'question' | 'mention' | 'link' | 'location' | 'achievement';
const STICKERS: { key: Sticker; label: string }[] = [
  { key: 'poll', label: 'Anket' },
  { key: 'question', label: 'Soru' },
  { key: 'mention', label: 'Bahset' },
  { key: 'link', label: 'Bağlantı' },
  { key: 'location', label: 'Konum' },
  { key: 'achievement', label: 'Başarı' },
];

export function StoryCreateScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [media, setMedia] = useState<{ localUri: string; id: string | null; video: boolean } | null>(null);
  const [text, setText] = useState('');
  const [background, setBackground] = useState<StoryBackground>('sunset');
  const [audience, setAudience] = useState<StoryAudience>('EVERYONE');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [pollQ, setPollQ] = useState('');
  const [pollA, setPollA] = useState('Evet');
  const [pollB, setPollB] = useState('Hayır');
  const [question, setQuestion] = useState('');
  const [mention, setMention] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [location, setLocation] = useState('');
  const [achievements, setAchievements] = useState<StoryAchievement[]>([]);
  const [achievement, setAchievement] = useState<StoryAchievement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.storyAchievements().then(setAchievements).catch(() => setAchievements([]));
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const has = (s: Sticker) => stickers.includes(s);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 30 });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    if (a.type === 'video' && (a.duration ?? 0) > 30_500) {
      showToast('Video en fazla 30 saniye olabilir.', 'warning');
      return;
    }
    const video = a.type === 'video';
    setMedia({ localUri: a.uri, id: null, video });
    const mime = video ? (a.mimeType === 'video/quicktime' ? 'video/quicktime' : 'video/mp4') : a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const ext = mime.split('/')[1] === 'quicktime' ? 'mov' : mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
    const file: UploadFile = { uri: a.uri, name: a.fileName ?? `hikaye.${ext}`, mimeType: mime, file: a.file };
    try {
      const up = await api.uploadStoryMedia(file);
      setMedia({ localUri: a.uri, id: up.id, video });
    } catch (e) {
      setMedia(null);
      showToast(errorText(e), 'warning');
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.createStory({
        mediaId: media?.id ?? null,
        text: text.trim() || null,
        background: media ? null : background,
        audience,
        poll: has('poll') && pollQ.trim() ? { question: pollQ.trim(), options: [pollA.trim() || 'Evet', pollB.trim() || 'Hayır'] } : null,
        question: has('question') ? question.trim() || null : null,
        mentions: has('mention') ? mention.split(/[\s,]+/).filter(Boolean) : [],
        link: has('link') && linkUrl.trim() ? { url: /^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}` } : null,
        location: has('location') ? location.trim() || null : null,
        achievement: has('achievement') && achievement ? { kind: achievement.kind, enrollmentId: achievement.enrollmentId, dayIndex: achievement.dayIndex } : null,
      });
      showToast('Hikâyen paylaşıldı');
      back();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const uploading = media !== null && media.id === null;
  const ready = !busy && !uploading && (media?.id || text.trim() || (has('achievement') && achievement));

  return (
    <Screen>
      <ScreenHeader title="Yeni hikâye" subtitle="24 saat görünür" onBack={back} />

      {/* Önizleme */}
      <View style={{ height: 260, borderRadius: 18, overflow: 'hidden', backgroundColor: media ? '#000' : backgroundColor(background), alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        {media && !media.video ? <Image source={{ uri: media.localUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
        {media?.video ? <Icon name="videocam" size={40} color="#FFFFFF" /> : null}
        {text.trim() ? (
          <Text variant="heading" align="center" style={{ color: '#FFFFFF', paddingHorizontal: 20, backgroundColor: media ? 'rgba(0,0,0,0.4)' : 'transparent' }}>
            {text}
          </Text>
        ) : !media ? (
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Yazını aşağıya yaz
          </Text>
        ) : null}
        {uploading ? (
          <Text variant="caption" style={{ color: '#FFFFFF', position: 'absolute', bottom: 10 }}>
            Yükleniyor…
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button label={media ? 'Değiştir' : 'Fotoğraf / video'} icon="images-outline" variant="secondary" block onPress={pick} />
        </View>
        {media ? (
          <View style={{ flex: 1 }}>
            <Button label="Kaldır" variant="ghost" block onPress={() => setMedia(null)} />
          </View>
        ) : null}
      </View>

      <TextField label={media ? 'Fotoğraf üstü yazı (isteğe bağlı)' : 'Yazı'} value={text} onChangeText={setText} multiline maxLength={300} autoCapitalize="sentences" />
      {!media ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          {BACKGROUNDS.map((b) => (
            <Pressable
              key={b.key}
              onPress={() => setBackground(b.key)}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              accessibilityState={{ selected: background === b.key }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: b.color, borderWidth: 3, borderColor: background === b.key ? c.text : 'transparent' }}
            />
          ))}
        </View>
      ) : null}

      <SectionHeader title="Kimler görsün?" />
      <ChipRow options={AUDIENCES} selected={[audience]} onToggle={setAudience} />
      {audience === 'CLOSE_FRIENDS' ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: 6 }} onPress={() => router.push('/close-friends')}>
          Yakın arkadaş listeni düzenle ›
        </Text>
      ) : null}

      <SectionHeader title="Çıkartmalar" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {STICKERS.map((s) => (
          <Chip key={s.key} label={s.label} selected={has(s.key)} onPress={() => setStickers((prev) => (prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key]))} />
        ))}
      </View>
      {has('poll') ? (
        <>
          <TextField label="Anket sorusu" value={pollQ} onChangeText={setPollQ} maxLength={80} autoCapitalize="sentences" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField label="1. seçenek" value={pollA} onChangeText={setPollA} maxLength={30} autoCapitalize="sentences" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="2. seçenek" value={pollB} onChangeText={setPollB} maxLength={30} autoCapitalize="sentences" />
            </View>
          </View>
        </>
      ) : null}
      {has('question') ? <TextField label="Soru (yanıtları sadece sen görürsün)" value={question} onChangeText={setQuestion} maxLength={80} autoCapitalize="sentences" /> : null}
      {has('mention') ? <TextField label="Bahsedilecek kişiler" value={mention} onChangeText={setMention} placeholder="@kullanici_adi" /> : null}
      {has('link') ? <TextField label="Bağlantı" value={linkUrl} onChangeText={setLinkUrl} placeholder="https://" keyboardType="url" /> : null}
      {has('location') ? <TextField label="Konum (elle yaz)" value={location} onChangeText={setLocation} placeholder="Örn. Kadıköy sahil" maxLength={60} autoCapitalize="words" /> : null}
      {has('achievement') ? (
        achievements.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {achievements.map((a) => (
              <Chip key={`${a.enrollmentId}-${a.kind}-${a.dayIndex ?? ''}`} label={`🏅 ${a.title}`} selected={achievement === a} onPress={() => setAchievement(achievement === a ? null : a)} />
            ))}
          </View>
        ) : (
          <Notice kind="info" text="Paylaşılacak başarın yok. Kütüphanedeki bir programın gününü tamamlayınca burada çıkar." />
        )
      ) : null}

      <Notice kind="info" text="Konum cihazından alınmaz; sadece yazdığın metin görünür. Sağlık ölçümlerin hikâyede paylaşılmaz." />
      <Button label={uploading ? 'Yükleniyor…' : 'Hikâyeni paylaş'} block onPress={submit} disabled={!ready} />
    </Screen>
  );
}
