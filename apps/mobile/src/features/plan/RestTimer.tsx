// Dinlenme / süre zamanlayıcısı: başlat, durdur, sıfırla. Süre bitince bildirim gösterir.
import { Button, showToast, Text } from '@fitapp/ui-mobile';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function RestTimer({ seconds, label }: { seconds: number; label: string }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        setRunning(false);
        showToast(`${label} bitti`, 'info');
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, label]);

  const start = () => {
    endAt.current = Date.now() + (left === 0 ? seconds : left) * 1000;
    if (left === 0) setLeft(seconds);
    setRunning(true);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text variant="heading" accessibilityLabel={`${label} kalan süre`}>
        {clock(left)}
      </Text>
      {running ? (
        <Button label="Durdur" size="sm" variant="secondary" onPress={() => setRunning(false)} />
      ) : (
        <Button label={left === seconds ? `${label} başlat` : 'Devam'} size="sm" onPress={start} />
      )}
      {left !== seconds && !running ? <Button label="Sıfırla" size="sm" variant="ghost" onPress={() => setLeft(seconds)} /> : null}
    </View>
  );
}
