// ☰ menüden açılır (alt menüde değil)
import { PushedScreen } from '@/components/PushedScreen';
import { UserProfile } from '@/features/profile/UserProfile';

export default function Screen() {
  return (
    <PushedScreen title="Ayarlar ve gizlilik">
      <UserProfile />
    </PushedScreen>
  );
}
