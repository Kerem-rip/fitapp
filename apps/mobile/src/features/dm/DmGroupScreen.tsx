// Grup bilgisi: ad, fotoğraf, üyeler. Yönetici üye ekler/çıkarır, yönetici atar, adı ve fotoğrafı değiştirir.
import type { DmConversationDetail, UploadFile } from '@fitapp/api-client';
import { BottomSheet, Button, Card, ListRow, Screen, ScreenHeader, SectionHeader, showToast, Tag, Text, TextField } from '@fitapp/ui-mobile';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';
import { PersonRow } from '@/components/social/PersonRow';
import { UserAvatar } from '@/components/social/UserAvatar';

type Member = DmConversationDetail['members'][number];

export function DmGroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [group, setGroup] = useState<DmConversationDetail | null>(null);
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [picked, setPicked] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    api
      .dmConversation(id)
      .then((g) => {
        setGroup(g);
        setTitle(g.title);
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  }, [id]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages'));
  const run = async (fn: () => Promise<DmConversationDetail>, message: string) => {
    setPicked(null);
    setRenaming(false);
    try {
      setGroup(await fn());
      showToast(message);
    } catch (e) {
      showToast(errorText(e), 'warning');
    }
  };
  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const file: UploadFile = { uri: a.uri, name: a.fileName ?? `grup.${mime === 'image/png' ? 'png' : 'jpg'}`, mimeType: mime, file: a.file };
    await run(() => api.dmGroupPhoto(id, file), 'Grup fotoğrafı güncellendi');
  };

  const admin = group?.myRole === 'ADMIN';
  return (
    <Screen>
      <ScreenHeader title="Grup bilgisi" onBack={back} />
      {group ? (
        <>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Pressable onPress={admin ? pickPhoto : undefined} disabled={!admin} accessibilityRole={admin ? 'button' : undefined} accessibilityLabel="Grup fotoğrafını değiştir">
              <UserAvatar name={group.title} url={group.avatarUrl} size={88} />
            </Pressable>
            <Text variant="title" style={{ marginTop: 8 }}>
              {group.title}
            </Text>
            <Text variant="caption" tone="secondary">
              {group.members.length} kişi
            </Text>
          </View>
          {admin ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Button label="Adı değiştir" variant="secondary" block onPress={() => setRenaming(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Üye ekle"
                  block
                  onPress={() => router.push({ pathname: '/dm-new', params: { mode: 'add', conversationId: id, exclude: group.members.map((m) => m.id).join(',') } })}
                />
              </View>
            </View>
          ) : null}

          <SectionHeader title="Üyeler" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {group.members.map((m, i) => (
              <PersonRow
                key={m.id}
                person={m}
                last={i === group.members.length - 1}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {m.role === 'ADMIN' ? <Tag label="Yönetici" kind="accent" /> : null}
                    {admin && !m.isMe ? <Button label="Yönet" size="sm" variant="ghost" onPress={() => setPicked(m)} /> : null}
                  </View>
                }
              />
            ))}
          </Card>
          <Button label="Gruptan ayrıl" variant="danger" block onPress={() => setLeaving(true)} style={{ marginTop: 16 }} />
        </>
      ) : null}

      <BottomSheet visible={picked !== null} onClose={() => setPicked(null)} title={picked?.displayName ?? ''}>
        {picked ? (
          <>
            <ListRow
              icon="shield-outline"
              title={picked.role === 'ADMIN' ? 'Yöneticilikten çıkar' : 'Yönetici yap'}
              onPress={() => run(() => api.dmSetAdmin(id, picked.id, picked.role !== 'ADMIN'), 'Güncellendi')}
            />
            <ListRow icon="person-remove-outline" title="Gruptan çıkar" onPress={() => run(() => api.dmRemoveMember(id, picked.id), 'Gruptan çıkarıldı')} last />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={renaming} onClose={() => setRenaming(false)} title="Grup adı">
        <TextField label="Ad" value={title} onChangeText={setTitle} maxLength={60} autoCapitalize="sentences" />
        <Button label="Kaydet" block disabled={!title.trim()} onPress={() => run(() => api.dmRename(id, title.trim()), 'Grup adı değişti')} />
      </BottomSheet>

      <BottomSheet visible={leaving} onClose={() => setLeaving(false)} title="Gruptan ayrılmak istiyor musun?">
        <Text variant="body" tone="secondary" style={{ marginBottom: 12 }}>
          Yeni mesajları göremezsin. Yeniden katılmak için bir yöneticinin seni eklemesi gerekir.
        </Text>
        <Button
          label="Gruptan ayrıl"
          variant="danger"
          block
          onPress={async () => {
            setLeaving(false);
            try {
              await api.dmLeave(id);
              router.replace('/messages');
            } catch (e) {
              showToast(errorText(e), 'warning');
            }
          }}
        />
      </BottomSheet>
    </Screen>
  );
}
