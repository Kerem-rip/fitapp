// Sunucu adresi. Uygulama içinden değiştirilebilir (gizli "Bağlantı ayarı"), böylece yeniden derlemeye gerek kalmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'fitapp-server-url';

// Varsayılan: tarayıcıda aynı bilgisayar; Android emülatöründe bilgisayarın özel adresi.
// BlueStacks veya gerçek telefonda bilgisayarın ağ adresi (ör. http://192.168.1.20:3000/api) elle girilir.
export const DEFAULT_SERVER_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? 'http://localhost:3000/api' : 'http://10.0.2.2:3000/api');

let current = DEFAULT_SERVER_URL;

export function getServerUrl(): string {
  return current;
}

export async function loadServerUrl(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) current = saved;
  } catch {
    // varsayılan kullanılır
  }
}

// "192.168.1.20:3000" gibi girişleri tam adrese çevirir
export function normalizeServerUrl(input: string): string {
  let url = input.trim();
  if (!url) return DEFAULT_SERVER_URL;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, '');
  if (!/\/api$/i.test(url)) url = `${url}/api`;
  return url;
}

export async function setServerUrl(input: string): Promise<string> {
  current = normalizeServerUrl(input);
  try {
    await AsyncStorage.setItem(KEY, current);
  } catch {
    // kaydedilemese de bu oturumda geçerli
  }
  return current;
}

// Sunucu ayakta mı?
export async function pingServer(url: string = current): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}
