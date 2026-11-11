// Sohbet. Uzman, mesajlaştığı bir kullanıcıyı buradan danışanı olarak ekleyebilir.
import { Avatar, Button, IconButton, Notice, Screen, showToast, Text, useTheme } from '@fitapp/ui-mobile';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { addClientFromAccount, markRead, sendMessage } from '@/demo/actions';
import { clockTime } from '@/demo/dates';
import { useAccount, useDemoState } from '@/demo/hooks';
import { accountById, activeLinkBetween, otherParty } from '@/demo/selectors';

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, accentGradient } = useTheme();
  const account = useAccount();
  const state = useDemoState();
  const [text, setText] = useState('');
  const scrollRef = useRef<{ scrollToEnd: (options?: { animated?: boolean }) => void } | null>(null);

  const conversation = state.shared.conversations.find((cv) => cv.id === id);
  const messageCount = conversation?.messages.length ?? 0;

  useEffect(() => {
    if (conversation && account) markRead(conversation.id, account.id);
  }, [conversation?.id, account?.id, messageCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messageCount]);

  if (!conversation || !account) {
    return (
      <Screen>
        <Text>Sohbet bulunamadı.</Text>
      </Screen>
    );
  }

  const other = otherParty(conversation, account.id);
  const otherAccount = accountById(state, other.id);
  const isPro = account.roleKey === 'dietitian' || account.roleKey === 'trainer';
  const canAddClient =
    isPro && otherAccount && (otherAccount.roleKey === 'user' || otherAccount.roleKey === 'teen') && !activeLinkBetween(state, other.id, account.id);

  const send = () => {
    if (!text.trim()) return;
    sendMessage(conversation.id, account.id, text);
    setText('');
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <IconButton icon="chevron-back" label="Geri" size={40} onPress={() => router.back()} />
          <Avatar name={other.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>
              {other.name}
            </Text>
          </View>
        </View>

        {canAddClient ? (
          <View style={{ marginBottom: 8 }}>
            <Notice kind="info" text="Bu kişi henüz danışanın değil. Danışan olarak eklersen plan atayabilir ve paylaştığı verileri görebilirsin." />
            <Button
              label="Danışan olarak ekle"
              size="sm"
              icon="person-add-outline"
              onPress={() => {
                const result = addClientFromAccount(account.id, other.id);
                showToast(result.ok ? 'Danışan olarak eklendi' : (result.error ?? 'Eklenemedi'), result.ok ? 'success' : 'warning');
              }}
            />
          </View>
        ) : null}

        <ScrollView
          ref={(node) => {
            scrollRef.current = node as unknown as { scrollToEnd: (options?: { animated?: boolean }) => void } | null;
          }}
          style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8, gap: 8 }} keyboardShouldPersistTaps="handled">
          {conversation.messages.length === 0 ? (
            <Text variant="caption" tone="muted" align="center" style={{ paddingVertical: 24 }}>
              Sohbeti başlatmak için bir mesaj yaz.
            </Text>
          ) : null}
          {conversation.messages.map((m) => {
            const mine = m.fromId === account.id;
            const bubble = (
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' }}>
                <Text variant="body" style={{ color: mine ? '#FFFFFF' : c.text }}>
                  {m.text}
                </Text>
                <Text variant="micro" style={{ color: mine ? 'rgba(255,255,255,0.8)' : c.textMuted, marginTop: 2, alignSelf: 'flex-end' }}>
                  {clockTime(m.at)}
                </Text>
              </View>
            );
            return (
              <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={{ maxWidth: '82%', borderRadius: 20, overflow: 'hidden', backgroundColor: mine ? undefined : c.surfaceAlt }}>
                  {mine ? (
                    <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      {bubble}
                    </LinearGradient>
                  ) : (
                    bubble
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 }}>
          <View style={{ flex: 1, backgroundColor: c.surfaceAlt, borderRadius: 24, paddingHorizontal: 16 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mesajını yaz"
              placeholderTextColor={c.textMuted}
              onSubmitEditing={send}
              style={{ color: c.text, fontSize: 16, minHeight: 46 }}
              multiline={false}
            />
          </View>
          <IconButton icon="send" label="Gönder" filled size={46} onPress={send} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
