// Başvuru belgesi seçici: PDF, JPG veya PNG; dosyadan ya da fotoğraf galerisinden.
import type { DocumentKind, UploadFile } from '@fitapp/api-client';
import { Button, Card, IconButton, Icon, Notice, Text, showToast, useTheme } from '@fitapp/ui-mobile';
import * as DocumentPickerModule from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { View } from 'react-native';
import { ChipRow } from './ChipRow';

export interface PickedDoc {
  id: string;
  kind: DocumentKind;
  file: UploadFile;
  sizeBytes?: number;
}

export const KIND_LABELS: Record<DocumentKind, string> = {
  diploma: 'Diploma',
  certificate: 'Antrenörlük / sertifika belgesi',
  business_license: 'İşletme belgesi (vergi levhası / ruhsat)',
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

let counter = 0;

export function DocumentPicker({
  docs,
  onChange,
  kinds,
  max = 5,
}: {
  docs: PickedDoc[];
  onChange: (docs: PickedDoc[]) => void;
  // Seçilebilecek belge türleri (alana göre)
  kinds: readonly DocumentKind[];
  max?: number;
}) {
  const { c } = useTheme();

  const add = (file: UploadFile, sizeBytes?: number) => {
    if (docs.length >= max) {
      showToast(`En fazla ${max} belge ekleyebilirsin`, 'warning');
      return;
    }
    if (sizeBytes !== undefined && sizeBytes > MAX_BYTES) {
      showToast('Dosya en fazla 10 MB olabilir', 'warning');
      return;
    }
    if (!ALLOWED.includes(file.mimeType)) {
      showToast('Sadece PDF, JPG veya PNG yükleyebilirsin', 'warning');
      return;
    }
    counter += 1;
    onChange([...docs, { id: `doc-${counter}`, kind: kinds[0]!, file, sizeBytes }]);
  };

  const pickFile = async () => {
    const result = await DocumentPickerModule.getDocumentAsync({ type: ALLOWED, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    add(
      { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', file: asset.file },
      asset.size,
    );
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    add(
      { uri: asset.uri, name: asset.fileName ?? `belge.${mime === 'image/png' ? 'png' : 'jpg'}`, mimeType: mime, file: asset.file },
      asset.fileSize,
    );
  };

  return (
    <View>
      {docs.map((doc) => (
        <Card key={doc.id} variant="outline" style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={doc.file.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={26} color={c.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {doc.file.name}
              </Text>
              {doc.sizeBytes ? (
                <Text variant="caption" tone="muted">
                  {(doc.sizeBytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB
                </Text>
              ) : null}
            </View>
            <IconButton icon="trash-outline" label="Belgeyi kaldır" size={36} onPress={() => onChange(docs.filter((d) => d.id !== doc.id))} />
          </View>
          {kinds.length > 1 ? (
            <View style={{ marginTop: 10 }}>
              <ChipRow
                wrap
                options={kinds.map((k) => ({ key: k, label: KIND_LABELS[k] }))}
                selected={[doc.kind]}
                onToggle={(k) => onChange(docs.map((d) => (d.id === doc.id ? { ...d, kind: k } : d)))}
              />
            </View>
          ) : (
            <Text variant="caption" tone="secondary" style={{ marginTop: 6 }}>
              {KIND_LABELS[doc.kind]}
            </Text>
          )}
        </Card>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button label="Dosya seç" variant="secondary" icon="document-attach-outline" block onPress={pickFile} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Fotoğraf seç" variant="secondary" icon="images-outline" block onPress={pickPhoto} />
        </View>
      </View>
      <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
        PDF, JPG veya PNG · en fazla 10 MB · en fazla {max} belge
      </Text>
      {docs.length === 0 ? <Notice kind="warning" text="En az bir belge eklemelisin." /> : null}
    </View>
  );
}
