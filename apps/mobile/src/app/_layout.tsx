// Uygulamanın ana çerçevesi: tüm ekranlar bunun içinde açılır.
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
