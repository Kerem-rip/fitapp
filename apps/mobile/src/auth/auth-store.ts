// Sunucudan gelen oturum bilgisi (kalıcı değil; açılışta sunucudan yeniden alınır).
import type { Me } from '@fitapp/api-client';
import { useSyncExternalStore } from 'react';

export interface AuthState {
  // Giriş yapan hesabın sunucudaki hali (başvuru durumu dahil)
  me: Me | null;
  // Başvurusu inceleniyor veya reddedilmiş kişi, "normal kullanıcı olarak devam et" dedi mi
  continueAsUser: boolean;
  // Açılışta oturum kontrolü bitti mi
  ready: boolean;
}

let state: AuthState = { me: null, continueAsUser: false, ready: false };
const listeners = new Set<() => void>();

export function getAuth(): AuthState {
  return state;
}

export function setAuth(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
}

// Profesyonel başvurusu henüz karara bağlanmamış ya da reddedilmiş mi (ve kişi "normal devam" demedi mi)
export function needsApplicationScreen(auth: AuthState): boolean {
  const status = auth.me?.application?.status;
  return (status === 'PENDING' || status === 'REJECTED') && !auth.continueAsUser;
}
