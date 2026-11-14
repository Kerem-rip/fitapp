// ☰ menüden açılır (alt menüde değil)
import { PushedScreen } from '@/components/PushedScreen';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';

export default function Screen() {
  return (
    <PushedScreen title="Keşfet">
      <DiscoverScreen />
    </PushedScreen>
  );
}
