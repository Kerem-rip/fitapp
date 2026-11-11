import { Stack } from 'expo-router';

// Karşılama (index) → sorular → kayıt / giriş. Uygulama her zaman karşılama ekranıyla açılır.
export const unstable_settings = { initialRouteName: 'index' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
