// Uygulamanın ana çerçevesi. Giriş durumuna ve hesap türüne göre doğru bölümü açar:
// girişsiz → (auth), giriş yapılmışsa hesabın rolüne ait panel.
import { ThemeProvider, ToastHost, useTheme } from '@fitapp/ui-mobile';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAccount } from '@/demo/hooks';
import { hydrate, useDemo, useHydrated } from '@/demo/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { c, scheme } = useTheme();
  const account = useAccount();
  const role = account?.roleKey;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!account}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'user' || role === 'teen'}>
          <Stack.Screen name="(user)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'dietitian'}>
          <Stack.Screen name="(dietitian)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'trainer'}>
          <Stack.Screen name="(trainer)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'gymManager'}>
          <Stack.Screen name="(gym-manager)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={role === 'gymStaff'}>
          <Stack.Screen name="(gym-staff)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const hydrated = useHydrated();
  const account = useAccount();
  const preference = useDemo((s) => s.ui.themePref);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <ThemeProvider role={account?.roleKey ?? 'user'} preference={preference}>
      <Shell />
    </ThemeProvider>
  );
}
