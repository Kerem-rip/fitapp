// Gönderi sayfası: gönderi, yorumlar ve yanıtlar. Yorumu yazan ya da gönderinin sahibi yorumu silebilir.
import type { CommentView, PostView } from '@fitapp/api-client';
import { EmptyState, Icon, Screen, ScreenHeader, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { timeAgo } from '@/demo/dates';
import { PostCard } from '@/components/social/PostCard';
import { ReportSheet } from '@/components/social/ReportSheet';
import { RichText } from '@/components/social/RichText';
import { UserAvatar } from '@/components/social/UserAvatar';

function CommentRow({ comment, onReply, onDelete, onReport, indent = false }: { comment: CommentView; onReply: () => void; onDelete: () => void; onReport: () => void; indent?: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, marginLeft: indent ? 44 : 0 }}>
      <Pressable onPress={() => router.push(`/u/${comment.author.username}`)} accessibilityRole="link">
        <UserAvatar name={comment.author.displayName} url={comment.author.avatarUrl} size={indent ? 28 : 34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="caption">
          <Text variant="caption" style={{ fontWeight: '700' }}>
            {comment.author.username}
          </Text>{' '}
          <Text variant="caption" tone="muted">
            {timeAgo(comment.createdAt)}
          </Text>
        </Text>
        <RichText text={comment.text} variant="body" />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
          <Text variant="caption" tone="secondary" onPress={onReply}>
            Yanıtla
          </Text>
          {comment.canDelete ? (
            <Text variant="caption" tone="secondary" onPress={onDelete}>
              Sil
            </Text>
          ) : null}
          {!comment.isMine ? (
            <Text variant="caption" tone="secondary" onPress={onReport}>
              Şikâyet et
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function PostDetailScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<PostView | null>(null);
  const [missing, setMissing] = useState(false);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, CommentView[]>>({});
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const loadComments = useCallback(
    async (after?: string) => {
      const page = await api.comments(id, after);
      setComments((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    },
    [id],
  );

  useEffect(() => {
    api
      .post(id)
      .then((p) => {
        setPost(p);
        return loadComments();
      })
      .catch(() => setMissing(true));
  }, [id, loadComments]);

  const showReplies = async (parent: CommentView) => {
    try {
      const page = await api.replies(id, parent.id);
      setReplies((prev) => ({ ...prev, [parent.id]: page.items }));
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const created = await api.addComment(id, body, replyTo?.id ?? null);
      setText('');
      if (created.parentId) {
        const parentId = created.parentId;
        setReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), created] }));
        setComments((prev) => prev.map((x) => (x.id === parentId ? { ...x, replyCount: x.replyCount + 1 } : x)));
      } else {
        setComments((prev) => [...prev, created]);
      }
      setReplyTo(null);
      setPost((p) => (p ? { ...p, counts: { ...p.counts, comments: p.counts.comments + 1 } } : p));
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (comment: CommentView) => {
    try {
      await api.deleteComment(comment.id);
      if (comment.parentId) {
        const parentId = comment.parentId;
        setReplies((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((x) => x.id !== comment.id) }));
        setComments((prev) => prev.map((x) => (x.id === parentId ? { ...x, replyCount: Math.max(0, x.replyCount - 1) } : x)));
      } else {
        setComments((prev) => prev.filter((x) => x.id !== comment.id));
      }
      setPost((p) => (p ? { ...p, counts: { ...p.counts, comments: Math.max(0, p.counts.comments - 1 - (comment.parentId ? 0 : comment.replyCount)) } } : p));
      showToast('Yorum silindi');
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <ScreenHeader title="Gönderi" onBack={back} />
      {missing ? <EmptyState icon="images-outline" title="Gönderi bulunamadı" text="Silinmiş ya da artık görüntülenemiyor olabilir." /> : null}
      {post ? (
        <>
          <PostCard post={post} onChange={setPost} onRemoved={back} detail />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 12, marginBottom: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `@${replyTo.author.username} kişisine yanıt yaz` : 'Yorum yaz…'}
              placeholderTextColor={c.textMuted}
              maxLength={500}
              multiline
              style={{ flex: 1, minHeight: 44, color: c.text, fontSize: 15, paddingVertical: 10 }}
              accessibilityLabel="Yorum"
            />
            <Pressable onPress={send} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Gönder" hitSlop={8}>
              <Icon name="send" size={22} color={text.trim() ? accent : c.textMuted} />
            </Pressable>
          </View>
          {replyTo ? (
            <Text variant="caption" tone="secondary" onPress={() => setReplyTo(null)} style={{ marginBottom: 8 }}>
              @{replyTo.author.username} kişisine yanıt veriyorsun · Vazgeç
            </Text>
          ) : null}

          {comments.length === 0 ? (
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
              İlk yorumu sen yaz.
            </Text>
          ) : null}
          {comments.map((cm) => (
            <View key={cm.id}>
              <CommentRow comment={cm} onReply={() => setReplyTo(cm)} onDelete={() => remove(cm)} onReport={() => setReportId(cm.id)} />
              {(replies[cm.id] ?? []).map((r) => (
                <CommentRow key={r.id} comment={r} indent onReply={() => setReplyTo(cm)} onDelete={() => remove(r)} onReport={() => setReportId(r.id)} />
              ))}
              {cm.replyCount > (replies[cm.id]?.length ?? 0) ? (
                <Text variant="caption" tone="secondary" style={{ marginLeft: 44, marginBottom: 6 }} onPress={() => showReplies(cm)}>
                  — Yanıtları gör ({cm.replyCount})
                </Text>
              ) : null}
            </View>
          ))}
          {cursor ? (
            <Text variant="bodyStrong" tone="accent" onPress={() => loadComments(cursor)} style={{ marginVertical: 8 }}>
              Daha fazla yorum
            </Text>
          ) : null}
        </>
      ) : null}
      <ReportSheet target={reportId ? { type: 'COMMENT', id: reportId } : null} onClose={() => setReportId(null)} />
    </Screen>
  );
}
