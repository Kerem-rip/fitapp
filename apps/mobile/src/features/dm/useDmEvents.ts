// Mesajlar için anlık güncelleme: ekran açıkken sunucuda bekleyen istek (long-polling) döner durur.
// Yeni olay gelince `onEvents` çağrılır; sunucu yeniden başladıysa `reset` true gelir (listeyi baştan yükle).
import type { DmEvent } from '@fitapp/api-client';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';

export function useDmEvents(onEvents: (events: DmEvent[], reset: boolean) => void) {
  const handler = useRef(onEvents);
  useEffect(() => {
    handler.current = onEvents;
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let boot: string | null = null;
      let seq = 0;
      void (async () => {
        while (alive) {
          try {
            const first = boot === null;
            const r = await api.dmEvents(boot, seq);
            if (!alive) break;
            boot = r.boot;
            seq = r.seq;
            if (r.events.length > 0 || (r.reset && !first)) handler.current(r.events, r.reset);
          } catch {
            // Bağlantı koptuysa biraz bekleyip yeniden dene
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );
}

// "çevrimiçi" / "son görülme 5 dk önce" (karşı taraf paylaşmıyorsa boş)
export function presenceText(p: { online?: boolean | null; lastSeenAt?: string | null } | null | undefined, ago: (iso: string) => string): string | null {
  if (!p) return null;
  if (p.online) return 'çevrimiçi';
  if (p.lastSeenAt) return `son görülme ${ago(p.lastSeenAt)} önce`;
  return null;
}
