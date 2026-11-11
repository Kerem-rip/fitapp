// Form parçaları ve alttan açılan pencere.
import { radius } from '@fitapp/design-tokens';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconButton, Text, tap, type IconName } from './primitives';
import { useTheme } from './theme';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
  error,
  hint,
  multiline = false,
  maxLength,
  onSubmitEditing,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  error?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
  onSubmitEditing?: () => void;
}) {
  const { c, accent } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text variant="caption" tone="secondary" style={{ marginBottom: 6, fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          backgroundColor: c.surfaceAlt,
          borderWidth: 1.5,
          borderColor: error ? c.danger : focused ? accent : 'transparent',
        }}
      >
        {icon ? <Icon name={icon} size={20} color={c.textMuted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          style={{
            flex: 1,
            color: c.text,
            fontSize: 16,
            paddingVertical: multiline ? 14 : 0,
            minHeight: multiline ? 88 : 52,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel="Şifreyi göster veya gizle">
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Ara',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 48,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        marginBottom: 12,
      }}
    >
      <Icon name="search" size={19} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={{ flex: 1, color: c.text, fontSize: 15 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
          <Icon name="close-circle" size={19} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SwitchRow({
  title,
  description,
  value,
  onChange,
  icon,
  last = false,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: IconName;
  last?: boolean;
}) {
  const { c, accent, accentSoft } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      {icon ? (
        <View
          style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={icon} size={19} color={accent} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          tap();
          onChange(v);
        }}
        trackColor={{ false: c.border, true: accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0.5,
  max = 10,
  step = 0.5,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconButton icon="remove" label="Azalt" size={38} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant="subheading" style={{ minWidth: 56, textAlign: 'center' }}>
        {format ? format(value) : String(value)}
      </Text>
      <IconButton icon="add" label="Arttır" size={38} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay }} onPress={onClose} />
        <View
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 680,
            maxHeight: '88%',
            backgroundColor: c.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text variant="heading" style={{ flex: 1 }}>
              {title}
            </Text>
            <IconButton icon="close" label="Kapat" size={36} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
