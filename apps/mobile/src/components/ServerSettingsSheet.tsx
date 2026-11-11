// Gizli "Bağlantı ayarı": uygulamanın bağlandığı sunucu adresi. Yeniden derlemeden değiştirilir.
import { BottomSheet, Button, Notice, showToast, Text, TextField } from '@fitapp/ui-mobile';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DEFAULT_SERVER_URL, getServerUrl, normalizeServerUrl, pingServer, setServerUrl } from '@/api/config';

export function ServerSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [value, setValue] = useState(getServerUrl());
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (visible) {
      setValue(getServerUrl());
      setStatus('idle');
    }
  }, [visible]);

  const test = async () => {
    setStatus('checking');
    setStatus((await pingServer(normalizeServerUrl(value))) ? 'ok' : 'fail');
  };

  const save = async () => {
    await setServerUrl(value);
    showToast('Bağlantı adresi kaydedildi');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Bağlantı ayarı">
      <Text variant="caption" tone="secondary" style={{ marginBottom: 12 }}>
        Uygulamanın bağlandığı sunucunun adresi. BlueStacks veya telefonda, bilgisayarın ağ adresini yaz (ör. 192.168.1.20:3000).
      </Text>
      <TextField label="Sunucu adresi" value={value} onChangeText={(t) => { setValue(t); setStatus('idle'); }} keyboardType="url" />
      {status === 'ok' ? <Notice kind="success" text="Sunucuya ulaşıldı." /> : null}
      {status === 'fail' ? (
        <Notice kind="danger" text="Sunucuya ulaşılamadı. Adresi, sunucunun çalıştığını ve aynı ağda olduğunu kontrol et." />
      ) : null}
      <View style={{ gap: 10, marginBottom: 8 }}>
        <Button label={status === 'checking' ? 'Deneniyor...' : 'Bağlantıyı dene'} variant="secondary" block onPress={test} disabled={status === 'checking'} />
        <Button label="Kaydet" size="lg" block onPress={save} />
        <Button label="Varsayılana dön" variant="ghost" block onPress={() => setValue(DEFAULT_SERVER_URL)} />
      </View>
    </BottomSheet>
  );
}
