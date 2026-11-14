// ☰ menüden açılır (alt menüde değil)
import { PushedScreen } from '@/components/PushedScreen';
import { ExercisesScreen } from '@/features/exercises/ExercisesScreen';

export default function Screen() {
  return (
    <PushedScreen title="Egzersizler">
      <ExercisesScreen />
    </PushedScreen>
  );
}
