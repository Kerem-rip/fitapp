// Beslenme rehberi: diyet türleri ve alışkanlık yazıları. Her yazıda diyetisyene yönlendirme vardır.
import { Button, Card, Notice, Screen, ScreenHeader, Tag, Text } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { findArticle } from '@/demo/content';
import { useAccount } from '@/demo/hooks';

export default function ArticleScreen() {
  const router = useRouter();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = findArticle(String(id));

  if (!article) {
    return (
      <Screen>
        <ScreenHeader title="Yazı bulunamadı" onBack={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={article.title} subtitle={`${article.minutes} dk okuma`} onBack={() => router.back()} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Tag label={article.tag} kind="accent" />
      </View>
      <Text variant="subheading" tone="secondary" style={{ marginBottom: 16 }}>
        {article.summary}
      </Text>
      {article.sections.map((s) => (
        <Card key={s.heading}>
          <Text variant="heading" style={{ marginBottom: 6 }}>
            {s.heading}
          </Text>
          <Text variant="body">{s.text}</Text>
        </Card>
      ))}
      {account?.roleKey !== 'teen' ? (
        <>
          <Notice kind="info" text="Size uygun olup olmadığını öğrenmek için bir diyetisyene danışın." />
          <Button label="Diyetisyen bul" block size="lg" onPress={() => router.push('/discover')} />
        </>
      ) : null}
    </Screen>
  );
}
