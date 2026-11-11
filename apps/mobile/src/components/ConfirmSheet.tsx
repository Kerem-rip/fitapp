// Onay penceresi. (Alert web'de çalışmadığı için alttan açılan pencere kullanılır.)
import { BottomSheet, Button, Text } from '@fitapp/ui-mobile';
import { View } from 'react-native';

export function ConfirmSheet({
  visible,
  title,
  text,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text variant="body" tone="secondary" style={{ marginBottom: 20 }}>
        {text}
      </Text>
      <View style={{ gap: 10, marginBottom: 8 }}>
        <Button
          label={confirmLabel}
          variant={danger ? 'danger' : 'primary'}
          size="lg"
          block
          onPress={() => {
            onConfirm();
            onClose();
          }}
        />
        <Button label="Vazgeç" variant="ghost" size="lg" block onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
