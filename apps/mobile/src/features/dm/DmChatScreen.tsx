// Sohbet ekranı (iki kişilik ya da grup): mesajlar anlık gelir; metin, fotoğraf ve video gönderilir.
// Mesaja basılı tutunca: yanıtla, benden sil, (kendi mesajında) geri al. İstek sohbetinde üstte Kabul et / Sil.
import type { DmConversationDetail, DmMessageItem, UploadFile } from '@fitapp/api-client';
import { BottomSheet, Button, Icon, IconButton, ListRow, Notice, Screen, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/media';
import { errorText } from '@/auth/actions';
import { ReportSheet } from '@/components/social/ReportSheet';
import { UserAvatar } from '@/components/social/UserAvatar';
import { VideoView } from '@/components/social/VideoView';
import { VoiceView } from '@/components/social/VoiceView';
import { clockTime, timeAgo } from '@/demo/dates';
import { presenceText, useDmEvents } from './useDmEvents';

const STATUS: Record<NonNullable<DmMessageItem['status']>, string> = { sent: 'Gönderildi', delivered: 'İletildi', seen: 'Görüldü' };

function Bubble({ m, group, onLongPress }: { m: DmMessageItem; group: boolean; onLongPress: () => void }) {
  const router = useRouter();
  const { c, accent } = useTheme();
  if (m.kind === 'SYSTEM') {
    return (
      <Text variant="micro" tone="muted" align="center" style={{ marginVertical: 8 }}>
        {m.text}
      </Text>
    );
  }
  const mine = m.isMine;
  const fg = mine ? '#FFFFFF' : c.text;
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 3 }}>
      {group && !mine ? (
        <Text variant="micro" tone="muted" style={{ marginLeft: 8, marginBottom: 2 }}>
          {m.sender.displayName}
        </Text>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityHint="Seçenekler için basılı tut"
        style={{ maxWidth: '80%', backgroundColor: mine ? accent : c.surface, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}
      >
        {m.unsent ? (
          <Text variant="caption" style={{ color: fg, fontStyle: 'italic', opacity: 0.8 }}>
            Mesaj geri alındı
          </Text>
        ) : (
          <>
            {m.replyTo ? (
              <View style={{ borderLeftWidth: 3, borderLeftColor: mine ? 'rgba(255,255,255,0.6)' : accent, paddingLeft: 8, marginBottom: 6 }}>
                <Text variant="micro" style={{ color: fg, opacity: 0.8 }}>
                  @{m.replyTo.username}
                </Text>
                <Text variant="caption" numberOfLines={2} style={{ color: fg, opacity: 0.8 }}>
                  {m.replyTo.preview}
                </Text>
              </View>
            ) : null}
            {m.story ? (
              <Text variant="micro" style={{ color: fg, opacity: 0.8, marginBottom: 4 }}>
                {m.story.available ? `Hikâyeye yanıt${m.story.text ? `: “${m.story.text.slice(0, 40)}”` : ''}` : 'Hikâyeye yanıt (hikâye artık görüntülenemiyor)'}
              </Text>
            ) : null}
            {m.media?.kind === 'IMAGE' ? <Image source={{ uri: mediaUrl(m.media.url) ?? undefined }} style={{ width: 220, height: 220, borderRadius: 12 }} contentFit="cover" accessibilityLabel="Fotoğraf" /> : null}
            {m.media?.kind === 'VIDEO' ? <VideoView url={m.media.url} width={220} height={220} durationMs={m.media.durationMs} label="Video" /> : null}
            {m.media?.kind === 'VOICE' ? <VoiceView url={m.media.url} durationMs={m.media.durationMs} light={mine} /> : null}
            {m.post ? (
              <Pressable
                onPress={'author' in m.post ? () => router.push(`/post/${m.post!.id}`) : undefined}
                style={{ borderWidth: 1, borderColor: mine ? 'rgba(255,255,255,0.5)' : c.border, borderRadius: 12, padding: 8, marginBottom: m.text ? 6 : 0, minWidth: 180 }}
              >
                {'author' in m.post ? (
                  <>
                    <Text variant="micro" style={{ color: fg, opacity: 0.85 }}>
                      {m.post.author.displayName} · @{m.post.author.username}
                    </Text>
                    {m.post.media[0]?.kind === 'IMAGE' ? <Image source={{ uri: mediaUrl(m.post.media[0].url) ?? undefined }} style={{ width: 200, height: 120, borderRadius: 8, marginTop: 4 }} contentFit="cover" /> : null}
                    {m.post.text ? (
                      <Text variant="caption" numberOfLines={3} style={{ color: fg, marginTop: 4 }}>
                        {m.post.text}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text variant="caption" style={{ color: fg, opacity: 0.8 }}>
                    Bu gönderi artık görüntülenemiyor.
                  </Text>
                )}
              </Pressable>
            ) : null}
            {m.text ? (
              <Text variant="body" style={{ color: fg }}>
                {m.text}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>
      <Text variant="micro" tone="muted" style={{ marginHorizontal: 8, marginTop: 1 }}>
        {clockTime(m.createdAt)}
        {m.status ? ` · ${m.seenBy !== undefined && m.status === 'seen' ? `${m.seenBy} kişi gördü` : STATUS[m.status]}` : ''}
      </Text>
    </View>
  );
}

export function DmChatScreen() {
  const router = useRouter();
  const { c, accent } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conv, setConv] = useState<DmConversationDetail | null>(null);
  const [items, setItems] = useState<DmMessageItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<DmMessageItem | null>(null);
  const [picked, setPicked] = useState<DmMessageItem | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages'));

  const refresh = useCallback(async () => {
    try {
      const [d, page] = await Promise.all([api.dmConversation(id), api.dmMessages(id)]);
      setConv(d);
      setItems(page.items);
      setCursor(page.nextCursor);
      // İstek kabul edilmeden "görüldü" bilgisi gitmez
      if (d.myStatus === 'ACTIVE') void api.dmRead(id).catch(() => undefined);
    } catch {
      setMissing(true);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useDmEvents((events, reset) => {
    if (reset || events.some((e) => e.conversationId === id)) void refresh();
  });

  const older = async () => {
    if (!cursor) return;
    const page = await api.dmMessages(id, cursor).catch(() => null);
    if (!page) return;
    setItems((prev) => [...prev, ...page.items.filter((m) => !prev.some((x) => x.id === m.id))]);
    setCursor(page.nextCursor);
  };

  const send = async (input: { text?: string; mediaId?: string }) => {
    setBusy(true);
    try {
      const m = await api.dmSend(id, { ...input, replyToId: replyTo?.id ?? null });
      setItems((prev) => [m, ...prev.filter((x) => x.id !== m.id)]);
      setText('');
      setReplyTo(null);
      if (conv?.myStatus === 'REQUEST') void refresh();
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 30 });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const video = a.type === 'video';
    const mime = video ? (a.mimeType === 'video/quicktime' ? 'video/quicktime' : 'video/mp4') : a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/mp4' ? 'mp4' : mime === 'image/png' ? 'png' : 'jpg';
    const file: UploadFile = { uri: a.uri, name: a.fileName ?? `mesaj.${ext}`, mimeType: mime, file: a.file };
    setBusy(true);
    try {
      const up = await api.dmUploadMedia(file);
      await send({ mediaId: up.id, text: text.trim() || undefined });
    } catch (e) {
      showToast(errorText(e), 'warning');
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, message?: string) => {
    setPicked(null);
    setMenu(false);
    try {
      await fn();
      if (message) showToast(message);
      await refresh();
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };

  const other = conv?.kind === 'DIRECT' ? conv.members.find((m) => !m.isMe) : undefined;
  const subtitle = conv?.kind === 'GROUP' ? `${conv.members.length} kişi` : presenceText(other, timeAgo);
  const request = conv?.myStatus === 'REQUEST';

  return (
    <Screen scroll={false}>
      {/* Üst çubuk */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
        <IconButton icon="chevron-back" label="Geri" onPress={back} />
        <Pressable
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          onPress={() => (conv?.kind === 'GROUP' ? router.push(`/dm-group/${id}`) : other ? router.push(`/u/${other.username}`) : undefined)}
          accessibilityRole="button"
        >
          <UserAvatar name={conv?.title ?? ''} url={conv?.avatarUrl} size={38} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {conv?.title ?? 'Sohbet'}
            </Text>
            {subtitle ? (
              <Text variant="micro" tone={other?.online ? 'success' : 'muted'}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {conv ? <IconButton icon="ellipsis-horizontal" label="Sohbet seçenekleri" onPress={() => setMenu(true)} /> : null}
      </View>

      {missing ? <Notice kind="warning" text="Sohbet bulunamadı ya da artık üyesi değilsin." /> : null}
      {request ? (
        <View style={{ marginBottom: 8 }}>
          <Notice kind="info" text={`${conv?.title ?? 'Bu kişi'} sana mesaj göndermek istiyor. Kabul edersen sohbet gelen kutuna taşınır.`} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Kabul et" block onPress={() => act(() => api.dmAccept(id), 'İstek kabul edildi')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Sil"
                variant="secondary"
                block
                onPress={async () => {
                  await api.dmDecline(id).catch(() => undefined);
                  back();
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
      {conv?.pendingRequest && !request ? <Notice kind="info" text="Mesajın istek olarak gider. Karşı taraf kabul edene kadar fotoğraf ve video gönderemezsin." /> : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          data={items}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble m={item} group={conv?.kind === 'GROUP'} onLongPress={() => setPicked(item)} />}
          onEndReached={older}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          ListEmptyComponent={
            conv && !missing ? (
              <Text variant="caption" tone="muted" align="center" style={{ marginTop: 24, transform: [{ scaleY: -1 }] }}>
                Henüz mesaj yok. İlk mesajı sen yaz.
              </Text>
            ) : undefined
          }
        />

        {replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              @{replyTo.sender.username} kişisine yanıt: {replyTo.text ?? 'medya'}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Yanıtı iptal et" hitSlop={8}>
              <Icon name="close" size={18} color={c.textMuted} />
            </Pressable>
          </View>
        ) : null}
        {conv && !missing ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
            <Pressable onPress={attach} disabled={busy || conv.pendingRequest} accessibilityRole="button" accessibilityLabel="Fotoğraf ya da video gönder" hitSlop={6} style={{ paddingVertical: 8 }}>
              <Icon name="image-outline" size={24} color={conv.pendingRequest ? c.border : c.textSecondary} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mesaj yaz…"
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={2000}
              style={{ flex: 1, minHeight: 40, maxHeight: 120, color: c.text, fontSize: 15, paddingVertical: 8 }}
              accessibilityLabel="Mesaj"
            />
            <Pressable onPress={() => send({ text: text.trim() })} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Gönder" hitSlop={6} style={{ paddingVertical: 8 }}>
              <Icon name="send" size={22} color={text.trim() ? accent : c.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* Mesaj seçenekleri */}
      <BottomSheet visible={picked !== null} onClose={() => setPicked(null)} title="Mesaj">
        {picked && !picked.unsent ? (
          <ListRow
            icon="arrow-undo-outline"
            title="Yanıtla"
            onPress={() => {
              setReplyTo(picked);
              setPicked(null);
            }}
          />
        ) : null}
        {picked?.isMine && !picked.unsent ? <ListRow icon="refresh-outline" title="Geri al" subtitle="Herkesten silinir" onPress={() => act(() => api.dmUnsend(picked.id), 'Mesaj geri alındı')} /> : null}
        {picked && !picked.isMine && !picked.unsent ? (
          <ListRow
            icon="flag-outline"
            title="Şikâyet et"
            subtitle="Moderatör sadece bu mesajı görür"
            onPress={() => {
              setReportId(picked.id);
              setPicked(null);
            }}
          />
        ) : null}
        {picked ? <ListRow icon="trash-outline" title="Benden sil" subtitle="Sadece sende görünmez olur" onPress={() => act(() => api.dmHide(picked.id))} last /> : null}
      </BottomSheet>

      <ReportSheet target={reportId ? { type: 'DM_MESSAGE', id: reportId } : null} onClose={() => setReportId(null)} />

      {/* Sohbet seçenekleri */}
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={conv?.title ?? 'Sohbet'}>
        {conv?.kind === 'GROUP' ? (
          <ListRow
            icon="people-outline"
            title="Grup bilgisi ve üyeler"
            onPress={() => {
              setMenu(false);
              router.push(`/dm-group/${id}`);
            }}
          />
        ) : null}
        <ListRow
          icon={conv?.muted ? 'notifications-outline' : 'notifications-off-outline'}
          title={conv?.muted ? 'Bildirimleri aç' : 'Sohbeti sessize al'}
          onPress={() => act(() => api.dmMute(id, !conv?.muted), conv?.muted ? 'Bildirimler açıldı' : 'Sohbet sessize alındı')}
        />
        <ListRow
          icon="trash-outline"
          title="Sohbeti sil"
          subtitle="Mesajlar sadece sende silinir"
          onPress={async () => {
            setMenu(false);
            await api.dmClear(id).catch(() => undefined);
            back();
          }}
          last
        />
      </BottomSheet>
    </Screen>
  );
}
