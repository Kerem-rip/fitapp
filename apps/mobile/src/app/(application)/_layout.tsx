import { Stack } from 'expo-router';

// Profesyonel başvurusu inceleniyor ya da reddedilmiş kişinin gördüğü tek bölüm.
export default function ApplicationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
