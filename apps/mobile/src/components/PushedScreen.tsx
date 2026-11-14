// Alt menüde olmayan, ☰ menüden açılan ekranlar için geri düğmeli üst başlık (temaya uyumlu).
import { useTheme } from '@fitapp/ui-mobile';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

export function PushedScreen({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      {children}
    </>
  );
}
