// Gönderi kartı (akış, profil, gönderi sayfası): yazar, metin, fotoğraflar, alıntı ve işlemler
// (beğen, yorum, paylaş, alıntıla, kaydet). Kendi gönderisinde sabitle, düzenle, sil.
import type { PostMediaItem, PostView } from '@fitapp/api-client';
import { BottomSheet, Button, Icon, ListRow, showToast, Text, TextField, useTheme, type IconName } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/media';
import { errorText } from '@/auth/actions';
import { timeAgo } from '@/demo/dates';
import { BadgeTag } from './BadgeTag';
import { ReportSheet } from './ReportSheet';
import { RichText } from './RichText';
import { UserAvatar } from './UserAvatar';
import { VideoView } from './VideoView';

function MediaStrip({ media, width }: { media: PostMediaItem[]; width: number }) {
  const { c } = useTheme();
  const [index, setIndex] = useState(0);
  if (media.length === 0) return null;
  return (
    <View style={{ marginTop: 10, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={64}
      >
        {media.map((m, i) =>
          m.kind === 'VIDEO' ? (
            <VideoView key={m.id} url={m.url} width={width} height={width} durationMs={m.durationMs} label={`Video ${i + 1} / ${media.length}`} />
          ) : (
            <Image key={m.id} source={{ uri: mediaUrl(m.url) ?? undefined }} style={{ width, height: width }} contentFit="cover" accessibilityLabel={`Fotoğraf ${i + 1} / ${media.length}`} />
          ),
        )}
      </ScrollView>
      {media.length > 1 ? (
        <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 4 }}>
          {media.map((m, i) => (
            <View key={m.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function PostCard({ post, onChange, onRemoved, detail = false }: { post: PostView; onChange: (next: PostView) => void; onRemoved?: () => void; detail?: boolean }) {
  const router = useRouter();
  const { c, accent } = useTheme();
  const { width: screen } = useWindowDimensions();
  // Kart iç genişliği (ekran kenar boşlukları ve kart dolgusu düşülür; geniş ekranda sınırlı)
  const width = Math.min(screen, 640) - 32 - 32;
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [draft, setDraft] = useState(post.text ?? '');

  const open = () => (detail ? undefined : router.push(`/post/${post.id}`));
  const toggleLike = async () => {
    const liked = !post.liked;
    onChange({ ...post, liked, counts: { ...post.counts, likes: post.counts.likes + (liked ? 1 : -1) } });
    try {
      const r = await api.likePost(post.id, liked);
      onChange({ ...post, liked: r.liked, counts: { ...post.counts, likes: r.likes } });
    } catch (e) {
      onChange(post);
      showToast(errorText(e), 'warning');
    }
  };
  const toggleSave = async () => {
    const saved = !post.saved;
    onChange({ ...post, saved });
    try {
      await api.savePost(post.id, saved);
      showToast(saved ? 'Kaydedilenlere eklendi' : 'Kaydedilenlerden çıkarıldı');
    } catch (e) {
      onChange(post);
      showToast(errorText(e), 'warning');
    }
  };
  const share = () => {
    setMenu(false);
    void Share.share({ message: `${post.author.displayName} (@${post.author.username}) fitapp'te paylaştı${post.text ? `: ${post.text.slice(0, 140)}` : ''}` });
  };
  const sendDm = () => {
    setMenu(false);
    router.push({ pathname: '/dm-new', params: { mode: 'share', postId: post.id } });
  };
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setMenu(false);
    try {
      await fn();
      showToast(message);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const action = (icon: IconName, label: string, onPress: () => void, count?: number, active = false) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
      <Icon name={icon} size={22} color={active ? accent : c.textSecondary} />
      {count !== undefined ? (
        <Text variant="caption" tone="secondary">
          {count > 0 ? count.toLocaleString('tr-TR') : ''}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.push(`/u/${post.author.username}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="link">
          <UserAvatar name={post.author.displayName} url={post.author.avatarUrl} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {post.author.displayName}
              </Text>
              {post.author.badges.map((b) => (
                <BadgeTag key={b.kind} badge={b} />
              ))}
            </View>
            <Text variant="caption" tone="muted">
              @{post.author.username} · {timeAgo(post.createdAt)}
              {post.editedAt ? ' · düzenlendi' : ''}
              {post.pinned ? ' · sabitlendi' : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Gönderi seçenekleri" hitSlop={8}>
          <Icon name="ellipsis-horizontal" size={20} color={c.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={open} disabled={detail}>
        {post.text ? <RichText text={post.text} variant="body" style={{ marginTop: 10 }} /> : null}
        <MediaStrip media={post.media} width={width} />
        {post.quoted ? (
          <Pressable
            onPress={post.quoted.available ? () => router.push(`/post/${post.quoted!.id}`) : undefined}
            style={{ marginTop: 10, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12 }}
          >
            {post.quoted.available ? (
              <>
                <Text variant="caption" tone="secondary">
                  {post.quoted.author.displayName} · @{post.quoted.author.username}
                </Text>
                {post.quoted.text ? (
                  <Text variant="body" numberOfLines={3} style={{ marginTop: 4 }}>
                    {post.quoted.text}
                  </Text>
                ) : null}
                {post.quoted.media[0] ? (
                  <Image source={{ uri: mediaUrl(post.quoted.media[0].url) ?? undefined }} style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 8 }} contentFit="cover" />
                ) : null}
              </>
            ) : (
              <Text variant="caption" tone="muted">
                Bu gönderi artık görüntülenemiyor.
              </Text>
            )}
          </Pressable>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 }}>
        {action(post.liked ? 'heart' : 'heart-outline', post.liked ? 'Beğeniyi geri al' : 'Beğen', toggleLike, post.counts.likes, post.liked)}
        {action('chatbubble-outline', 'Yorumlar', () => router.push(`/post/${post.id}`), post.counts.comments)}
        {action('repeat-outline', 'Alıntıla', () => router.push({ pathname: '/compose', params: { quote: post.id } }))}
        {action('paper-plane-outline', 'Mesajla gönder', sendDm)}
        <View style={{ flex: 1 }} />
        {action(post.saved ? 'bookmark' : 'bookmark-outline', post.saved ? 'Kaydedilenlerden çıkar' : 'Kaydet', toggleSave, undefined, post.saved)}
      </View>
      {post.counts.likes > 0 ? (
        <Pressable onPress={() => router.push(`/post-likes/${post.id}`)} accessibilityRole="button">
          <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
            {post.counts.likes.toLocaleString('tr-TR')} beğeni
          </Text>
        </Pressable>
      ) : null}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Gönderi">
        {post.isMine ? (
          <>
            <ListRow
              icon="pin-outline"
              title={post.pinned ? 'Sabitlemeyi kaldır' : 'Profilde sabitle'}
              onPress={() =>
                run(async () => {
                  await api.pinPost(post.id, !post.pinned);
                  onChange({ ...post, pinned: !post.pinned });
                }, post.pinned ? 'Sabitleme kaldırıldı' : 'Profilinde sabitlendi')
              }
            />
            <ListRow
              icon="create-outline"
              title="Açıklamayı düzenle"
              onPress={() => {
                setMenu(false);
                setDraft(post.text ?? '');
                setEditing(true);
              }}
            />
            <ListRow icon="chatbubbles-outline" title="Mesajla gönder" onPress={sendDm} />
            <ListRow icon="paper-plane-outline" title="Paylaş" onPress={share} />
            <ListRow
              icon="trash-outline"
              title="Sil"
              onPress={() => {
                setMenu(false);
                setConfirmDelete(true);
              }}
              last
            />
          </>
        ) : (
          <>
            <ListRow icon="person-outline" title="Profili gör" onPress={() => { setMenu(false); router.push(`/u/${post.author.username}`); }} />
            <ListRow icon="chatbubbles-outline" title="Mesajla gönder" onPress={sendDm} />
            <ListRow icon="paper-plane-outline" title="Paylaş" onPress={share} />
            <ListRow
              icon="flag-outline"
              title="Şikâyet et"
              onPress={() => {
                setMenu(false);
                setReporting(true);
              }}
              last
            />
          </>
        )}
      </BottomSheet>

      <ReportSheet target={reporting ? { type: 'POST', id: post.id } : null} onClose={() => setReporting(false)} />

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title="Açıklamayı düzenle">
        <TextField label="Açıklama" value={draft} onChangeText={setDraft} multiline maxLength={2200} autoCapitalize="sentences" />
        <Button
          label="Kaydet"
          block
          onPress={() =>
            run(async () => {
              const next = await api.editPost(post.id, draft.trim() || null);
              setEditing(false);
              onChange(next);
            }, 'Güncellendi')
          }
        />
      </BottomSheet>

      <BottomSheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Gönderi silinsin mi?">
        <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
          Gönderi, fotoğrafları, beğenileri ve yorumlarıyla birlikte kaldırılır. Bu işlem geri alınamaz.
        </Text>
        <Button
          label="Sil"
          variant="danger"
          block
          onPress={async () => {
            setConfirmDelete(false);
            try {
              await api.deletePost(post.id);
              showToast('Gönderi silindi');
              onRemoved?.();
            } catch (e) {
              showToast(errorText(e), 'warning');
            }
          }}
        />
      </BottomSheet>
    </View>
  );
}
