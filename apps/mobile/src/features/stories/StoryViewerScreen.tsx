// Hikâye izleme: tam ekran; sağa/sola dokununca sonraki/önceki, basılı tutunca durur. Fotoğraf 5 sn, video kendi süresi.
// Çıkartmalar: anket, soru, bağlantı, konum, bahsetme, başarı. İzleyen emoji tepkisi verir;
// sahibi izleyenleri ve yanıtları görür, hikâyeyi silebilir.
import type { StoryItem } from '@fitapp/api-client';
import { BottomSheet, Button, Icon, ListRow, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/media';
import { errorText } from '@/auth/actions';
import { timeAgo } from '@/demo/dates';
import { PersonRow } from '@/components/social/PersonRow';
import { ReportSheet } from '@/components/social/ReportSheet';
import { UserAvatar } from '@/components/social/UserAvatar';
import { VideoView } from '@/components/social/VideoView';
import { backgroundColor, PHOTO_MS, REACTIONS } from './story-style';

type Insights = Awaited<ReturnType<typeof api.storyInsights>>;

export function StoryViewerScreen() {
  const router = useRouter();
  const { accent } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [stories, setStories] = useState<StoryItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reply, setReply] = useState('');
  const [insights, setInsights] = useState<Insights | null>(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const elapsedRef = useRef(0);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);

  useEffect(() => {
    api
      .userStories(userId)
      .then((list) => {
        setStories(list);
        // İlk görülmemiş hikâyeden başla
        const first = list.findIndex((s) => !s.viewed && !s.isMine);
        setIndex(first === -1 ? 0 : first);
      })
      .catch(() => setStories([]));
  }, [userId]);

  const story = stories?.[index];
  const total = story?.media?.kind === 'VIDEO' ? Math.min(30_000, story.media.durationMs ?? PHOTO_MS) : PHOTO_MS;

  // Görüldü bilgisi
  const storyId = story?.id;
  const markView = Boolean(story && !story.isMine && !story.viewed);
  useEffect(() => {
    elapsedRef.current = 0;
    if (storyId && markView) void api.viewStory(storyId).catch(() => undefined);
  }, [storyId, markView]);

  const next = useCallback(() => {
    if (!stories) return;
    elapsedRef.current = 0;
    setElapsed(0);
    if (index + 1 < stories.length) setIndex(index + 1);
    else close();
  }, [stories, index, close]);
  const prev = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    setIndex((i) => Math.max(0, i - 1));
  };

  const holding = paused || menu || reporting || insights !== null || answer.length > 0 || reply.length > 0;
  // Süre sayacı: durdurulunca kaldığı yerden devam eder
  useEffect(() => {
    if (!storyId || holding) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      if (elapsedRef.current >= total) {
        clearInterval(timer);
        next();
      } else setElapsed(elapsedRef.current);
    }, 100);
    return () => clearInterval(timer);
  }, [storyId, holding, total, next]);

  if (stories && stories.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text variant="body" style={{ color: '#FFFFFF', marginBottom: 16 }}>
          Görüntülenecek hikâye yok.
        </Text>
        <Button label="Kapat" variant="light" onPress={close} />
      </View>
    );
  }
  if (!story) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  const update = (patch: Partial<StoryItem>) => setStories((list) => list?.map((s) => (s.id === story.id ? { ...s, ...patch } : s)) ?? null);
  const react = async (emoji: string) => {
    const nextEmoji = story.myReaction === emoji ? null : emoji;
    update({ myReaction: nextEmoji });
    try {
      await api.reactStory(story.id, nextEmoji);
      if (nextEmoji) showToast(`${nextEmoji} gönderildi`);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const vote = async (option: number) => {
    try {
      const poll = await api.voteStory(story.id, option);
      update({ poll });
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const sendAnswer = async () => {
    try {
      await api.answerStory(story.id, answer);
      setAnswer('');
      showToast('Yanıtın gönderildi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  // Hikâyeye yanıt, sahibine özel mesaj olarak gider
  const sendReply = async () => {
    try {
      await api.dmSendToUser(story.author.id, { storyId: story.id, text: reply.trim() });
      setReply('');
      showToast('Yanıtın mesaj olarak gönderildi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const openInsights = async () => {
    try {
      setInsights(await api.storyInsights(story.id));
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const remove = async () => {
    setMenu(false);
    try {
      await api.deleteStory(story.id);
      showToast('Hikâye silindi');
      const rest = stories!.filter((s) => s.id !== story.id);
      if (rest.length === 0) close();
      else {
        setStories(rest);
        setIndex((i) => Math.min(i, rest.length - 1));
      }
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const chip = { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center' as const, marginTop: 10 };
  const white = { color: '#FFFFFF' };

  return (
    <View style={{ flex: 1, backgroundColor: story.media ? '#000' : backgroundColor(story.background) }}>
      {story.media?.kind === 'IMAGE' ? (
        <Image source={{ uri: mediaUrl(story.media.url) ?? undefined }} style={{ position: 'absolute', width, height }} contentFit="contain" accessibilityLabel="Hikâye fotoğrafı" />
      ) : null}
      {story.media?.kind === 'VIDEO' ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <VideoView url={story.media.url} width={width} height={Math.min(height, (width * 16) / 9)} durationMs={story.media.durationMs} label="Hikâye videosu" />
        </View>
      ) : null}

      {/* Dokunma alanları: sol önceki, sağ sonraki; basılı tutunca durur */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Önceki hikâye" />
        <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Sonraki hikâye" />
      </View>

      {/* Üst: ilerleme, yazar, kapat */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {stories!.map((s, i) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <View style={{ height: 3, backgroundColor: '#FFFFFF', width: i < index ? '100%' : i === index ? `${Math.min(100, (elapsed / total) * 100)}%` : '0%' }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }} pointerEvents="box-none">
          <Pressable onPress={() => router.push(`/u/${story.author.username}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }} accessibilityRole="link">
            <UserAvatar name={story.author.displayName} url={story.author.avatarUrl} size={32} />
            <Text variant="bodyStrong" style={white} numberOfLines={1}>
              {story.author.displayName}
            </Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {timeAgo(story.createdAt)}
            </Text>
          </Pressable>
          {story.isMine ? (
            <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Hikâye seçenekleri" hitSlop={8}>
              <Icon name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable onPress={() => setReporting(true)} accessibilityRole="button" accessibilityLabel="Hikâyeyi şikâyet et" hitSlop={8}>
              <Icon name="flag-outline" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8}>
            <Icon name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Orta: yazı ve çıkartmalar */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }} pointerEvents="box-none">
        {story.text ? (
          <Text variant={story.media ? 'heading' : 'title'} align="center" style={[white, story.media ? { backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 } : null]}>
            {story.text}
          </Text>
        ) : null}
        {story.achievement ? (
          <View style={[chip, { backgroundColor: accent, paddingVertical: 14 }]}>
            <Text variant="bodyStrong" style={white}>
              🏅 {story.achievement.title}
            </Text>
          </View>
        ) : null}
        {story.location ? (
          <View style={chip}>
            <Text variant="caption" style={white}>
              📍 {story.location}
            </Text>
          </View>
        ) : null}
        {story.mentions.map((m) => (
          <Pressable key={m} onPress={() => router.push(`/u/${m}`)} style={chip} accessibilityRole="link">
            <Text variant="caption" style={white}>
              @{m}
            </Text>
          </Pressable>
        ))}
        {story.link ? (
          <Pressable onPress={() => void Linking.openURL(story.link!.url)} style={[chip, { backgroundColor: '#FFFFFF' }]} accessibilityRole="link">
            <Text variant="bodyStrong" style={{ color: '#1F2433' }}>
              🔗 {story.link.label ?? story.link.url.replace(/^https?:\/\//, '').slice(0, 30)}
            </Text>
          </Pressable>
        ) : null}
        {story.poll ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 12 }}>
            <Text variant="bodyStrong" align="center" style={{ color: '#1F2433', marginBottom: 10 }}>
              {story.poll.question}
            </Text>
            {story.poll.options.map((o, i) => {
              const results = story.poll!.results;
              const sum = results ? results.reduce((a, b) => a + b, 0) : 0;
              const pct = results && sum ? Math.round((results[i]! / sum) * 100) : 0;
              return (
                <Pressable
                  key={o}
                  onPress={() => (results || story.isMine ? undefined : vote(i))}
                  disabled={Boolean(results) || story.isMine}
                  accessibilityRole="button"
                  style={{ borderRadius: 10, backgroundColor: '#EEF0F5', marginBottom: 6, overflow: 'hidden' }}
                >
                  {results ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, backgroundColor: story.poll!.myVote === i ? accent : '#C9CEDA' }} /> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
                    <Text variant="bodyStrong" style={{ color: '#1F2433' }}>
                      {o}
                    </Text>
                    {results ? (
                      <Text variant="bodyStrong" style={{ color: '#1F2433' }}>
                        %{pct}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {story.question ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 12 }}>
            <Text variant="bodyStrong" align="center" style={{ color: '#1F2433', marginBottom: 8 }}>
              {story.question}
            </Text>
            {story.isMine ? (
              <Text variant="caption" align="center" style={{ color: '#5A6175' }}>
                Yanıtlar izleyenler listesinde
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF0F5', borderRadius: 10, paddingHorizontal: 10 }}>
                <TextInput value={answer} onChangeText={setAnswer} placeholder="Yanıtını yaz…" placeholderTextColor="#8A90A2" maxLength={300} style={{ flex: 1, height: 40, color: '#1F2433' }} accessibilityLabel="Soruya yanıt" />
                <Pressable onPress={sendAnswer} disabled={!answer.trim()} accessibilityRole="button" accessibilityLabel="Yanıtı gönder" hitSlop={8}>
                  <Icon name="send" size={20} color={answer.trim() ? accent : '#B4B9C6'} />
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Alt: tepkiler ya da (sahibine) izleyenler */}
      <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 12 }}>
        {story.isMine ? (
          <Pressable onPress={openInsights} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Icon name="eye-outline" size={20} color="#FFFFFF" />
            <Text variant="bodyStrong" style={white}>
              {story.counts?.views ?? 0} izleyen
              {story.counts?.answers ? ` · ${story.counts.answers} yanıt` : ''}
            </Text>
          </Pressable>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 22, paddingHorizontal: 12, marginBottom: 8 }}>
              <TextInput value={reply} onChangeText={setReply} placeholder="Mesaj gönder…" placeholderTextColor="rgba(255,255,255,0.7)" maxLength={500} style={{ flex: 1, height: 42, color: '#FFFFFF' }} accessibilityLabel="Hikâyeye yanıt" />
              <Pressable onPress={sendReply} disabled={!reply.trim()} accessibilityRole="button" accessibilityLabel="Yanıtı gönder" hitSlop={8}>
                <Icon name="send" size={20} color={reply.trim() ? '#FFFFFF' : 'rgba(255,255,255,0.4)'} />
              </Pressable>
            </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => react(e)}
                accessibilityRole="button"
                accessibilityLabel={`${e} tepkisi`}
                style={{ padding: 6, borderRadius: 20, backgroundColor: story.myReaction === e ? 'rgba(255,255,255,0.3)' : 'transparent' }}
              >
                <Text variant="title">{e}</Text>
              </Pressable>
            ))}
          </View>
          </View>
        )}
      </View>

      <ReportSheet target={reporting ? { type: 'STORY', id: story.id } : null} onClose={() => setReporting(false)} />

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Hikâye">
        <ListRow icon="eye-outline" title="İzleyenler ve yanıtlar" onPress={() => { setMenu(false); void openInsights(); }} />
        <ListRow icon="trash-outline" title="Hikâyeyi sil" onPress={remove} last />
      </BottomSheet>

      <BottomSheet visible={insights !== null} onClose={() => setInsights(null)} title={`${insights?.views.length ?? 0} izleyen`}>
        {insights?.answers.length ? (
          <>
            <Text variant="bodyStrong" style={{ marginBottom: 6 }}>
              Yanıtlar
            </Text>
            {insights.answers.map((a) => (
              <Text key={a.id} variant="body" style={{ marginBottom: 6 }}>
                <Text variant="body" style={{ fontWeight: '700' }}>
                  @{a.person.username}
                </Text>{' '}
                {a.text}
              </Text>
            ))}
          </>
        ) : null}
        {insights?.views.map((v, i) => (
          <PersonRow
            key={v.person.id}
            person={v.person}
            last={i === insights.views.length - 1}
            trailing={v.reaction ? <Text variant="heading">{v.reaction}</Text> : undefined}
          />
        ))}
        {insights && insights.views.length === 0 ? (
          <Text variant="caption" tone="muted">
            Henüz kimse görmedi.
          </Text>
        ) : null}
      </BottomSheet>
    </View>
  );
}
