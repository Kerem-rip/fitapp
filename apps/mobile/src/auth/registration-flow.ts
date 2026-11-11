// Kayıt sırasında e-posta kodu ekranına taşınan geçici bilgiler (bellekte; adres çubuğuna yazılmaz).
import type { DocumentKind } from '@fitapp/api-client';
import { useSyncExternalStore } from 'react';

export interface RegistrationFlow {
  registrationId: string;
  email: string;
  accountType: 'USER' | 'PROFESSIONAL';
  codeExpiresAt: string;
  // Sadece sunucu test modundayken gelir ("test kodu")
  devCode?: string;
  requiredDocuments: DocumentKind[];
}

let flow: RegistrationFlow | null = null;
const listeners = new Set<() => void>();

export const getFlow = () => flow;

export function setFlow(next: RegistrationFlow | null) {
  flow = next;
  listeners.forEach((l) => l());
}

export function patchFlow(patch: Partial<RegistrationFlow>) {
  if (flow) setFlow({ ...flow, ...patch });
}

export function useFlow(): RegistrationFlow | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => flow,
    () => flow,
  );
}
