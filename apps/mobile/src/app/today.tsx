// ☰ menüden açılır (alt menüde değil)
import { PushedScreen } from '@/components/PushedScreen';
import { UserHome } from '@/features/home/UserHome';

export default function Screen() {
  return (
    <PushedScreen title="Bugün">
      <UserHome />
    </PushedScreen>
  );
}
