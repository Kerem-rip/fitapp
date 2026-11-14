// Doğrulanmış mesleki unvan rozeti (yönetici onayından geçmiş yetkiye göre sunucu verir; kullanıcı kendine atayamaz).
import type { Badge } from '@fitapp/api-client';
import { Tag } from '@fitapp/ui-mobile';

export function BadgeTag({ badge }: { badge: Badge }) {
  return <Tag label={badge.label} kind="accent" icon="checkmark-circle" />;
}
