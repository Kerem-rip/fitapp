// Takip düğmesi: Takip et → (gizli hesapta) İstek gönderildi / (açık hesapta) Takiptesin. Tekrar dokununca geri alır.
import type { FollowState } from '@fitapp/api-client';
import { Button, showToast } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/auth/actions';

const LABEL: Record<FollowState, string> = { NONE: 'Takip et', PENDING: 'İstek gönderildi', ACCEPTED: 'Takiptesin' };

export function FollowButton({
  userId,
  state,
  followsMe = false,
  onChange,
  size = 'md',
  block = false,
}: {
  userId: string;
  state: FollowState;
  followsMe?: boolean;
  onChange: (next: FollowState) => void;
  size?: 'sm' | 'md';
  block?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    setBusy(true);
    try {
      const r = state === 'NONE' ? await api.follow(userId) : await api.unfollow(userId);
      onChange(r.following);
    } catch (e) {
      showToast(errorText(e), 'warning');
    } finally {
      setBusy(false);
    }
  };
  // Beni takip eden birini ben takip etmiyorsam "Sen de takip et"
  const label = state === 'NONE' && followsMe ? 'Sen de takip et' : LABEL[state];
  return <Button label={label} size={size} block={block} variant={state === 'NONE' ? 'primary' : 'secondary'} onPress={press} disabled={busy} />;
}
