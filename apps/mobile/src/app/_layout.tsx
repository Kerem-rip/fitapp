// Uygulamanın ana çerçevesi. Giriş durumuna ve hesap türüne göre doğru bölümü açar:
// girişsiz → (auth); profesyonel başvurusu inceleniyorsa → (application);
// aksi halde hesabın rolüne ait panel. Başvurusu onaylanmamış kişi profesyonel alanı hiç görmez.
import { ThemeProvider, ToastHost, useTheme } from '@fitapp/ui-mobile';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { loadServerUrl } from '@/api/config';
import { setSessionExpiredHandler } from '@/api/client';
import { handleSessionExpired, restoreSession } from '@/auth/actions';
import { needsApplicationScreen, useAuth } from '@/auth/auth-store';
import { useAccount, roleTheme } from '@/demo/hooks';
import { hydrate, useDemo, useHydrated } from '@/demo/store';

SplashScreen.preventAutoHideAsync().catch(() => {});
setSessionExpiredHandler(handleSessionExpired);

function Shell() {
  const { c, scheme } = useTheme();
  const account = useAccount();
  const auth = useAuth();
  const role = account?.roleKey;
  const applicationScreen = Boolean(account) && needsApplicationScreen(auth);
  const consumer = (role === 'user' || role === 'teen') && !applicationScreen;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!account}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={applicationScreen}>
          <Stack.Screen name="(application)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={consumer}>
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
        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen name="(admin)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const hydrated = useHydrated();
  const auth = useAuth();
  const account = useAccount();
  const preference = useDemo((s) => s.ui.themePref);

  useEffect(() => {
    void (async () => {
      await loadServerUrl();
      await hydrate();
      await restoreSession();
    })();
  }, []);

  const ready = hydrated && auth.ready;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider role={roleTheme(account?.roleKey)} preference={preference}>
      <Shell />
    </ThemeProvider>
  );
}
