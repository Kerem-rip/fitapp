// ☰ menüden açılır (alt menüde değil)
import { PushedScreen } from '@/components/PushedScreen';
import { NutritionScreen } from '@/features/nutrition/NutritionScreen';

export default function Screen() {
  return (
    <PushedScreen title="Öğün ve su kaydı">
      <NutritionScreen />
    </PushedScreen>
  );
}
