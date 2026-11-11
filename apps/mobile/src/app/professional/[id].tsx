// Uzman profili: vitrin, mesaj at, takip et, yorumlar.
// Uzmana herkes doğrudan mesaj atabilir. Yorumu sadece danışan bağlantısı kurulmuş kişiler yazabilir.
import { Avatar, Button, Card, ListRow, Notice, Screen, ScreenHeader, SectionHeader, showToast, Stars, Tag, Text, TextField } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { postReview, startConversation, toggleFollow } from '@/demo/actions';
import { formatLong, dateKey } from '@/demo/dates';
import { useAccount, useDemoState, useShared, useUserData } from '@/demo/hooks';
import { MODE_LABELS } from '@/demo/labels';
import { activeLinkBetween, fullName, proById } from '@/demo/selectors';

export default function ProfessionalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const account = useAccount();
  const state = useDemoState();
  const shared = useShared();
  const data = useUserData();
  const pro = proById(String(id));

  const myReview = shared.reviews.find((r) => r.proId === pro?.id && r.authorAccountId === account?.id);
  const [rating, setRating] = useState(myReview?.rating ?? 5);
  const [text, setText] = useState(myReview?.text ?? '');
  useEffect(() => {
    setRating(myReview?.rating ?? 5);
    setText(myReview?.text ?? '');
  }, [myReview?.rating, myReview?.text]);

  if (!pro || !account) {
    return (
      <Screen>
        <ScreenHeader title="Profil bulunamadı" onBack={() => router.back()} />
      </Screen>
    );
  }

  const isConsumer = account.roleKey === 'user' || account.roleKey === 'teen';
  const teenBlocked = account.roleKey === 'teen' && data.parentalApproval !== 'approved';
  const following = data.following.includes(pro.id);
  const link = pro.accountId ? activeLinkBetween(state, account.id, pro.accountId) : undefined;
  const reviews = shared.reviews.filter((r) => r.proId === pro.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rating5 = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : pro.rating;
  const gym = pro.kind === 'gym' ? shared.gyms.find((g) => g.id === 'gym-fitmerkez') : undefined;
  const lessons = gym && pro.id === 'pro-fitmerkez'
    ? shared.gymLessons.filter((l) => l.kind === 'group' && l.date >= dateKey(0)).slice(0, 4)
    : [];

  const message = () => {
    if (teenBlocked) {
      showToast('Uzmanlara mesaj atmak için veli onayı gerekir', 'warning');
      return;
    }
    const conversationId = startConversation(
      { id: account.id, name: fullName(account) },
      { id: pro.accountId ?? pro.id, name: pro.name },
    );
    router.push(`/chat/${conversationId}`);
  };

  const submitReview = () => {
    if (!pro.accountId) return;
    if (!text.trim()) {
      showToast('Yorumunu yaz', 'warning');
      return;
    }
    const result = postReview({ proAccountId: pro.accountId, proId: pro.id, authorAccountId: account.id, rating, text });
    showToast(result.ok ? 'Yorumun yayınlandı' : (result.error ?? 'Yorum kaydedilemedi'), result.ok ? 'success' : 'warning');
  };

  return (
    <Screen>
      <ScreenHeader title={pro.name} subtitle={`${pro.title} · ${pro.city}`} onBack={() => router.back()} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={pro.name} size={72} story />
          <View style={{ flex: 1, marginLeft: 8, gap: 6 }}>
            <Tag label="Doğrulanmış" kind="success" icon="checkmark-circle" />
            <Text variant="caption" tone="secondary">
              {MODE_LABELS[pro.mode]} · {pro.priceRange}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#8883' }}>
          {[
            [pro.kind === 'gym' ? 'Üye' : 'Danışan', String(pro.clientCount)],
            ['Puan', rating5.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })],
            ['Takipçi', String(pro.followers + (following ? 1 : 0))],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="title">{value}</Text>
              <Text variant="caption" tone="secondary">
                {label}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="body" style={{ marginTop: 14 }}>
          {(pro.accountId ? state.accounts.find((a) => a.id === pro.accountId)?.bio : '') || pro.bio}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {pro.specialties.map((s) => (
            <Tag key={s} label={s} kind="accent" />
          ))}
        </View>
      </Card>

      {isConsumer ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Button label="Mesaj at" icon="chatbubble-ellipses-outline" size="lg" block onPress={message} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={following ? 'Takiptesin' : 'Takip et'}
              variant={following ? 'secondary' : 'ghost'}
              size="lg"
              block
              icon={following ? 'checkmark' : 'person-add-outline'}
              onPress={() => toggleFollow(account.id, pro.id)}
            />
          </View>
        </View>
      ) : null}
      {teenBlocked ? <Notice kind="warning" text="Genç modunda uzmanlara mesaj atmak için veli onayı gerekir." /> : null}
      {link ? <Notice kind="success" title="Danışanısın" text="Bu uzmanla danışan bağlantın aktif. Paylaşım izinlerini Profil bölümünden yönetebilirsin." /> : null}

      {lessons.length > 0 ? (
        <>
          <SectionHeader title="Yaklaşan grup dersleri" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {lessons.map((l, i) => (
              <ListRow
                key={l.id}
                icon="calendar-outline"
                title={`${l.title} · ${l.time}`}
                subtitle={formatLong(l.date)}
                last={i === lessons.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={`Yorumlar (${reviews.length})`} />
      {reviews.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Avatar name={r.authorName} size={34} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{r.authorName}</Text>
              <Stars value={r.rating} size={13} />
            </View>
            <Tag label={`Danışan · ${r.clientFor}`} kind="success" icon="ribbon-outline" />
          </View>
          <Text variant="body">{r.text}</Text>
          {r.reply ? (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#8881' }}>
              <Text variant="caption" tone="secondary" style={{ fontWeight: '700' }}>
                {pro.name} cevapladı
              </Text>
              <Text variant="body">{r.reply}</Text>
            </View>
          ) : null}
        </Card>
      ))}
      {reviews.length === 0 ? (
        <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>
          Henüz yorum yok.
        </Text>
      ) : null}

      {isConsumer && pro.kind !== 'gym' ? (
        link ? (
          <Card>
            <Text variant="heading" style={{ marginBottom: 8 }}>
              {myReview ? 'Yorumunu güncelle' : 'Yorum yaz'}
            </Text>
            <View style={{ marginBottom: 12 }}>
              <Stars value={rating} onChange={setRating} size={28} />
            </View>
            <TextField value={text} onChangeText={setText} placeholder="Deneyimini paylaş" multiline maxLength={400} />
            <Button label={myReview ? 'Güncelle' : 'Yorumu gönder'} block onPress={submitReview} />
          </Card>
        ) : (
          <Notice kind="info" text="Yorum yazmak için bu uzmanın danışanı olman gerekir. Böylece yorumlar gerçek deneyimlerden oluşur." />
        )
      ) : null}
    </Screen>
  );
}
