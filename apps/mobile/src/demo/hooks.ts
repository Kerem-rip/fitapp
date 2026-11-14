// Ekranların kullandığı okuma kancaları.
import { useMemo } from 'react';
import type { RoleTheme } from '@fitapp/design-tokens';
import { showToast } from '@fitapp/ui-mobile';
import { dateKey } from './dates';
import { newUserData } from './seed';
import { useDemo } from './store';
import type { DemoAccount, DemoState, SharedState, UserData } from './types';

export function useDemoState(): DemoState {
  return useDemo((s) => s);
}

export function useShared(): SharedState {
  return useDemo((s) => s.shared);
}

// Giriş yapmış hesap (yoksa null)
export function useAccount(): DemoAccount | null {
  return useDemo((s) => (s.session ? s.accounts.find((a) => a.id === s.session!.accountId) ?? null : null));
}

const EMPTY_USER = newUserData();

// Giriş yapmış kullanıcının kişisel verileri
export function useUserData(): UserData {
  return useDemo((s) => (s.session ? s.userData[s.session.accountId] ?? EMPTY_USER : EMPTY_USER));
}

export function useToday(): string {
  return useMemo(() => dateKey(0), []);
}

// Sağlık verisi (öğün, kilo) kaydetmeden önce açık rıza kontrolü. Rıza yoksa uyarı gösterir ve false döner.
export function useEnsureConsent(): () => boolean {
  const data = useUserData();
  return () => {
    if (data.consents.health_data) return true;
    showToast('Önce Profil bölümünden sağlık verisi iznini ver', 'warning');
    return false;
  };
}

const PRO_ROLES = new Set(['dietitian', 'trainer', 'gymManager', 'gymStaff']);
export const isProRole = (roleKey: DemoAccount['roleKey'] | undefined) => roleKey !== undefined && PRO_ROLES.has(roleKey);

// Hangi arayüz açık: profesyonel olmayan hesap her zaman sosyal; profesyonel son kullandığı (ilk girişte sosyal)
export function useSurface(): 'social' | 'pro' {
  return useDemo((s) => {
    const account = s.session ? s.accounts.find((a) => a.id === s.session!.accountId) : undefined;
    if (!account || !isProRole(account.roleKey)) return 'social';
    return s.ui.surfaces?.[account.id] ?? 'social';
  });
}

export function roleTheme(roleKey: DemoAccount['roleKey'] | undefined): RoleTheme {
  return roleKey ?? 'user';
}

// Giriş yapmış ama onaylanmamış profesyonel başvurusu olan kişi de vurgu rengi olarak profesyonel alanını değil,
// standart rengini görür (profesyonel alanın nasıl göründüğü onaydan önce bilinmez).

// Rol → ana sayfa adresi
export function homeRouteFor(roleKey: DemoAccount['roleKey']): string {
  switch (roleKey) {
    case 'dietitian':
      return '/(dietitian)';
    case 'trainer':
      return '/(trainer)';
    case 'gymManager':
      return '/(gym-manager)';
    case 'gymStaff':
      return '/(gym-staff)';
    case 'admin':
      return '/(admin)';
    default:
      return '/(user)';
  }
}
