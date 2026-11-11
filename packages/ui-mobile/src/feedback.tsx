// Kısa süreli bildirim ("Yemek eklendi" gibi).
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from './primitives';
import { useTheme } from './theme';

type ToastKind = 'success' | 'info' | 'warning';
interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}
type Listener = (message: ToastMessage) => void;

const listeners = new Set<Listener>();
let sequence = 0;

export function showToast(text: string, kind: ToastKind = 'success') {
  sequence += 1;
  listeners.forEach((listener) => listener({ id: sequence, text, kind }));
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener: Listener = (next) => {
      setMessage(next);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      }, 2200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer) clearTimeout(timer);
    };
  }, [opacity]);

  if (!message) return null;
  const icon = message.kind === 'success' ? 'checkmark-circle' : message.kind === 'warning' ? 'alert-circle' : 'information-circle';
  const color = message.kind === 'success' ? c.success : message.kind === 'warning' ? c.warning : c.info;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center', zIndex: 100 }}>
      <Animated.View
        style={{
          opacity,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: '#14171E',
          maxWidth: '92%',
        }}
      >
        <Icon name={icon} size={18} color={color} />
        <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
          {message.text}
        </Text>
      </Animated.View>
    </View>
  );
}
