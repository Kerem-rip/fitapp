// Oturum anahtarlarının saklandığı yer: telefonda güvenli depo (Keychain / Keystore), tarayıcıda yerel depo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TokenStore, Tokens } from '@fitapp/api-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'fitapp-tokens';

export const tokenStore: TokenStore = {
  async get(): Promise<Tokens | null> {
    try {
      const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  async set(tokens: Tokens | null): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (tokens) await AsyncStorage.setItem(KEY, JSON.stringify(tokens));
        else await AsyncStorage.removeItem(KEY);
      } else if (tokens) {
        await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
      } else {
        await SecureStore.deleteItemAsync(KEY);
      }
    } catch {
      // saklanamazsa bu oturum bellekte kalır
    }
  },
};
