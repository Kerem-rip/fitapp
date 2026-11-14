// Sunucunun verdiği medya yolunu ("/media/<id>?e=..&s=..") tam adrese çevirir. Adres süreli ve imzalıdır.
import { getServerUrl } from './config';

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${getServerUrl()}${path}`;
}
