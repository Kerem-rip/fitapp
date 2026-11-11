// Uzmanın aktif danışanları ve bunlarla ilgili hatırlatıcılar.
import { useMemo } from 'react';
import { useAccount, useDemoState } from '@/demo/hooks';
import { activeLinksOf, clientView, type ClientView } from '@/demo/selectors';
import type { ClientLink } from '@/demo/types';

export interface ClientItem {
  link: ClientLink;
  view: ClientView;
  isNew: boolean;
  needsAttention: boolean;
  // Alerji bilgisi girilmemiş (diyetisyen için güvenlik açısından önemli)
  allergyMissing: boolean;
}

export function useClients(): ClientItem[] {
  const account = useAccount();
  const state = useDemoState();

  return useMemo(() => {
    if (!account) return [];
    return activeLinksOf(state, account.id).flatMap((link) => {
      const view = clientView(state, link.clientId);
      if (!view) return [];
      const isNew = Date.now() - new Date(link.startedAt).getTime() < 4 * 86400000;
      return [
        {
          link,
          view,
          isNew,
          needsAttention: view.lastEntryDaysAgo >= 5,
          allergyMissing: view.allergens === null,
        },
      ];
    });
  }, [state, account]);
}
