// Beslenme sekmesi: öğünler, kalori hesaplayıcı ve örnek menü (genç modunda sadece öğün günlüğü ve rehber).
import { Screen, ScreenHeader, Segmented } from '@fitapp/ui-mobile';
import { useState } from 'react';
import { useAccount } from '@/demo/hooks';
import { CalculatorView } from './CalculatorView';
import { MealsView } from './MealsView';
import { MenuView } from './MenuView';

type View = 'meals' | 'calc' | 'menu';

export function NutritionScreen() {
  const account = useAccount();
  const [view, setView] = useState<View>('meals');
  const teen = account?.roleKey === 'teen';

  return (
    <Screen tabBarInset>
      <ScreenHeader title="Beslenme" subtitle={teen ? 'Dengeli beslenme alışkanlığı' : 'Öğünlerin, hedefin ve önerilerin'} />
      {teen ? (
        <MealsView hideCalories />
      ) : (
        <>
          <Segmented<View>
            options={[
              { key: 'meals', label: 'Öğünler' },
              { key: 'calc', label: 'Hesapla' },
              { key: 'menu', label: 'Örnek menü' },
            ]}
            value={view}
            onChange={setView}
          />
          {view === 'meals' ? <MealsView /> : view === 'calc' ? <CalculatorView /> : <MenuView />}
        </>
      )}
    </Screen>
  );
}
