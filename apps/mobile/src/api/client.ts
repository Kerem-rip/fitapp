// Uygulamanın tek API istemcisi.
import { createApiClient } from '@fitapp/api-client';
import { getServerUrl } from './config';
import { tokenStore } from './tokens';

let sessionExpiredHandler: (() => void) | null = null;

// Oturum yenilenemeyince ne yapılacağı (ör. giriş ekranına dön) uygulama başlarken bağlanır
export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

export const api = createApiClient({
  getBaseUrl: getServerUrl,
  tokens: tokenStore,
  onSessionExpired: () => sessionExpiredHandler?.(),
});

export { ApiError } from '@fitapp/api-client';
