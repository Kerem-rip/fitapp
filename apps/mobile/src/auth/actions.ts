// Giriş, kayıt, çıkış ve hesap işlemleri (sunucuyla). Sunucudaki hesap, yerel depoya yansıtılır;
// ekranlar yerel depoyu okuduğu için geri kalan uygulama aynı şekilde çalışır.
import { api, ApiError } from '@/api/client';
import type { AuthResult, Gender, Me } from '@fitapp/api-client';
import { Platform } from 'react-native';
import { logout, mirrorServerAccount, patchLocalAccount } from '@/demo/actions';
import { getState } from '@/demo/store';
import type { DemoAccount, RoleKey } from '@/demo/types';
import { getAuth, setAuth } from './auth-store';

const deviceName = () => Platform.OS;

// Demo salon verisi sadece demo hesaplara bağlıdır (gerçek salon verisi sonra sunucuya taşınacak)
const DEMO_GYM_ACCOUNTS = new Set(['acc-selim', 'acc-deniz']);

export function roleKeyOf(me: Me): RoleKey {
  if (me.roles.includes('ADMIN') || me.roles.includes('MODERATOR')) return 'admin';
  if (me.roles.includes('DIETITIAN')) return 'dietitian';
  if (me.roles.includes('TRAINER')) return 'trainer';
  if (me.roles.includes('GYM_MANAGER')) return 'gymManager';
  if (me.roles.includes('GYM_STAFF')) return 'gymStaff';
  return me.ageGroup === 'TEEN' ? 'teen' : 'user';
}

const SEX: Record<Gender, DemoAccount['sex']> = { FEMALE: 'female', MALE: 'male', OTHER: 'other', UNSPECIFIED: 'other' };

export function accountFromMe(me: Me): DemoAccount {
  const previous = getState().accounts.find((a) => a.id === me.id);
  return {
    id: me.id,
    roleKey: roleKeyOf(me),
    email: me.email,
    username: me.username,
    password: '',
    firstName: me.firstName ?? '',
    lastName: me.lastName ?? '',
    birthDate: me.birthDate.slice(0, 10),
    sex: SEX[me.gender],
    city: previous?.city,
    title: previous?.title,
    bio: me.bio ?? '',
    gymId: DEMO_GYM_ACCOUNTS.has(me.id) ? 'gym-fitmerkez' : undefined,
    isSeed: false,
  };
}

async function loadConsents(accountId: string): Promise<{ health_data: boolean; marketing: boolean }> {
  try {
    const list = await api.consents();
    return {
      health_data: list.some((c) => c.type === 'health_data'),
      marketing: list.some((c) => c.type === 'marketing'),
    };
  } catch {
    // Sunucuya ulaşılamazsa son bilinen değer korunur
    return getState().userData[accountId]?.consents ?? { health_data: false, marketing: false };
  }
}

// Sunucudaki hesap bilgisini yerel depoya ve oturum durumuna işler
export async function applyMe(me: Me): Promise<void> {
  const consents = await loadConsents(me.id);
  mirrorServerAccount(accountFromMe(me), { consents, isPrivate: me.isPrivate });
  setAuth({ me });
}

export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  const result = await api.login(identifier, password, deviceName());
  setAuth({ continueAsUser: false });
  await applyMe(result.user);
  return result;
}

// Gizli yönetici girişi (normal girişten ayrı)
export async function adminSignIn(identifier: string, password: string): Promise<AuthResult> {
  const result = await api.adminLogin(identifier, password, deviceName());
  setAuth({ continueAsUser: false });
  await applyMe(result.user);
  return result;
}

// E-posta kodu doğrulanınca hesap açılır ve oturum başlar
export async function completeRegistration(result: AuthResult): Promise<void> {
  setAuth({ continueAsUser: false });
  await applyMe(result.user);
}

export async function refreshMe(): Promise<Me> {
  const me = await api.me();
  await applyMe(me);
  return me;
}

export async function signOut(): Promise<void> {
  await api.logout();
  logout();
  setAuth({ me: null, continueAsUser: false });
}

// Uygulama açılırken: kayıtlı oturum varsa sunucudan doğrular
export async function restoreSession(): Promise<void> {
  try {
    if (!(await api.hasSession())) {
      // Sunucu oturumu yoksa yerel oturum da geçersizdir (eski demo oturumu gibi)
      if (getState().session) logout();
      return;
    }
    await refreshMe();
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')) {
      // Sunucuya ulaşılamıyor: son bilinen hesapla devam edilir, bağlantı gelince yenilenir
      return;
    }
    logout();
    setAuth({ me: null });
  } finally {
    setAuth({ ready: true });
  }
}

// Oturum yenilenemediğinde (ör. başka cihazdan çıkış) giriş ekranına döner
export function handleSessionExpired() {
  logout();
  setAuth({ me: null, continueAsUser: false });
}

export async function deleteAccount(password: string): Promise<void> {
  await api.requestDeletion(password);
  // Sunucu tüm oturumları zaten kapattı; cihazdaki anahtarlar temizlenir
  await api.logout();
  logout();
  setAuth({ me: null, continueAsUser: false });
}

export async function saveProfile(patch: { firstName?: string; lastName?: string; username?: string; bio?: string }): Promise<void> {
  const me = await api.updateMe(patch);
  patchLocalAccount(me.id, {
    firstName: me.firstName ?? '',
    lastName: me.lastName ?? '',
    username: me.username,
    bio: me.bio ?? '',
  });
  setAuth({ me });
}

export async function setPrivateRemote(isPrivate: boolean): Promise<void> {
  await api.updateMe({ isPrivate });
  await refreshMe();
}

export async function setConsentRemote(type: 'health_data' | 'marketing', value: boolean): Promise<void> {
  if (value) await api.grantConsent(type);
  else await api.revokeConsent(type);
  await refreshMe();
}

export function continueAsNormalUser() {
  setAuth({ continueAsUser: true });
}

export function showApplicationStatus() {
  setAuth({ continueAsUser: false });
}

export function currentMe(): Me | null {
  return getAuth().me;
}

// Hata nesnesinden kullanıcıya gösterilecek metin
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Bir sorun oluştu. Tekrar dene.';
}
