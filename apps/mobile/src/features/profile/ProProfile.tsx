// Uzman profili (diyetisyen ve bağımsız eğitmen): müşterilerin gördüğü vitrin, hizmet bilgileri ve yorumlar.
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  ListRow,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader,
  showToast,
  Stars,
  Tag,
  Text,
  TextField,
} from '@fitapp/ui-mobile';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AccountSection } from '@/components/AccountSection';
import { errorText, saveProfile } from '@/auth/actions';
import { replyToReview } from '@/demo/actions';
import { useAccount, useShared } from '@/demo/hooks';
import { MODE_LABELS, ROLE_LABELS } from '@/demo/labels';
import { fullName, proByAccount } from '@/demo/selectors';
import { useClients } from '@/features/pro/useClients';

export function ProProfile() {
  const router = useRouter();
  const account = useAccount();
  const shared = useShared();
  const clients = useClients();
  const [bioOpen, setBioOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const pro = account ? proByAccount(account.id) : undefined;
  const reviews = useMemo(
    () => shared.reviews.filter((r) => r.proId === pro?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [shared.reviews, pro?.id],
  );

  if (!account || !pro) return null;
  const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : pro.rating;

  const saveBio = () => {
    saveProfile({ bio: bio.trim() })
      .then(() => {
        setBioOpen(false);
        showToast('Tanıtım yazın güncellendi');
      })
      .catch((e) => showToast(errorText(e), 'warning'));
  };

  const sendReply = () => {
    if (!replyId || !reply.trim()) return;
    replyToReview(replyId, reply);
    setReplyId(null);
    setReply('');
    showToast('Cevabın yayınlandı');
  };

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Profil" subtitle={ROLE_LABELS[account.roleKey]} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={fullName(account)} size={72} story />
          <View style={{ flex: 1, marginLeft: 8, gap: 6 }}>
            <Text variant="title" numberOfLines={2}>
              {pro.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {pro.title} · {pro.city}
            </Text>
            <Tag label="Doğrulanmış" kind="success" icon="checkmark-circle" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#8883' }}>
          {[
            ['Danışan', String(clients.length)],
            ['Puan', rating.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })],
            ['Takipçi', String(pro.followers)],
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
          {account.bio || pro.bio}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {pro.specialties.map((s) => (
            <Tag key={s} label={s} kind="accent" />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label="Düzenle" variant="secondary" block icon="create-outline" onPress={() => { setBio(account.bio || pro.bio); setBioOpen(true); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Müşteriler nasıl görür" variant="ghost" block onPress={() => router.push(`/professional/${pro.id}`)} />
          </View>
        </View>
      </Card>

      <SectionHeader title="Hizmet bilgileri" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="location-outline" title="Şehir" trailing={<Text variant="bodyStrong">{pro.city}</Text>} />
        <ListRow icon="videocam-outline" title="Hizmet şekli" trailing={<Text variant="bodyStrong">{MODE_LABELS[pro.mode]}</Text>} />
        <ListRow icon="cash-outline" title="Fiyat aralığı" trailing={<Text variant="bodyStrong">{pro.priceRange}</Text>} />
        <ListRow icon="ribbon-outline" title="Diploma ve sertifikalar" trailing={<Tag label="Onaylandı" kind="success" />} last />
      </Card>
      <Notice kind="info" text="Danışanlarınla aranızdaki hizmet ücretleri uygulamayı ilgilendirmez; ödeme uygulama üzerinden alınmaz." />

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
                Cevabın
              </Text>
              <Text variant="body">{r.reply}</Text>
            </View>
          ) : (
            <Button label="Cevapla" variant="secondary" size="sm" onPress={() => { setReplyId(r.id); setReply(''); }} style={{ marginTop: 10 }} />
          )}
        </Card>
      ))}

      <AccountSection />

      <BottomSheet visible={bioOpen} onClose={() => setBioOpen(false)} title="Tanıtım yazısı">
        <TextField value={bio} onChangeText={setBio} multiline maxLength={300} autoCapitalize="sentences" />
        <Button label="Kaydet" size="lg" block onPress={saveBio} style={{ marginBottom: 8 }} />
      </BottomSheet>

      <BottomSheet visible={replyId !== null} onClose={() => setReplyId(null)} title="Yoruma cevap">
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>
          Her yoruma bir kez cevap yazabilirsin.
        </Text>
        <TextField value={reply} onChangeText={setReply} multiline maxLength={300} autoCapitalize="sentences" />
        <Button label="Yayınla" size="lg" block onPress={sendReply} style={{ marginBottom: 8 }} />
      </BottomSheet>
    </Screen>
  );
}
