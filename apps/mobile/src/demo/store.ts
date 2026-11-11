// Demo verisinin yerel deposu. Veriler telefonda kalır; uygulama kapanıp açılsa da korunur.
// Gerçek sunucu bağlanınca bu dosya api-client çağrılarıyla değişecek.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { createSeed, DEMO_STATE_VERSION } from './seed';
import type { DemoState } from './types';

const STORAGE_KEY = 'fitapp-demo-state';
const DELETION_GRACE_DAYS = 30;

let state: DemoState = createSeed();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function persistNow() {
  if (persistTimer) clearTimeout(persistTimer);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 250);
}

export function getState(): DemoState {
  return state;
}

export function setState(updater: (current: DemoState) => DemoState) {
  state = updater(state);
  schedulePersist();
  emit();
}

// 30 gün geri dönüş süresi dolan hesaplar kalıcı olarak silinir
function purgeExpiredAccounts(current: DemoState): DemoState {
  const cutoff = Date.now() - DELETION_GRACE_DAYS * 86400000;
  const expired = Object.entries(current.userData)
    .filter(([, data]) => data.deletionRequestedAt && new Date(data.deletionRequestedAt).getTime() <= cutoff)
    .map(([id]) => id);
  if (expired.length === 0) return current;
  const userData = { ...current.userData };
  for (const id of expired) delete userData[id];
  return { ...current, accounts: current.accounts.filter((a) => !expired.includes(a.id)), userData };
}

export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === DEMO_STATE_VERSION) state = purgeExpiredAccounts(parsed);
    }
  } catch {
    // bozuk kayıt varsa temiz başla
  }
  hydrated = true;
  emit();
}

// Tüm demo verisini ilk haline döndürür
export function resetDemo() {
  state = createSeed();
  persistNow();
  emit();
}

// Not: seçici fonksiyonlar state içindeki mevcut nesneleri döndürmeli (filter/map ile yeni dizi değil);
// türetilmiş veriler bileşende useMemo ile hesaplanır.
export function useDemo<T>(selector: (current: DemoState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrated,
    () => hydrated,
  );
}
