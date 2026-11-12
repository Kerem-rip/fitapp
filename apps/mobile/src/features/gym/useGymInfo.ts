// Gerçek (sunucudaki) salon bilgisi: giriş yapan kişinin salondaki görevi ve yetkileri.
// Sunucuya ulaşılamıyorsa ya da kişinin salonu yoksa null kalır; ekranlar o zaman demo veriyle çalışır.
import type { GymInfo } from '@fitapp/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';

export function useGymInfo() {
  const [info, setInfo] = useState<GymInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    api
      .gymMe()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoaded(true));
  }, []);

  useFocusEffect(reload);

  const can = useCallback((permission: string) => info?.permissions.includes(permission) ?? false, [info]);
  return { info, loaded, can, reload };
}
