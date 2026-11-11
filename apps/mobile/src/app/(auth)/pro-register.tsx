// Profesyonel kayıt: seçilen alana göre form ve belgeler.
import type { ProfessionalField } from '@fitapp/api-client';
import { Screen, ScreenHeader } from '@fitapp/ui-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FIELD_LABELS, RegisterForm } from '@/components/RegisterForm';

export default function ProRegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ field?: string }>();
  const field: ProfessionalField = params.field === 'TRAINER' || params.field === 'GYM_OWNER' ? params.field : 'DIETITIAN';
  return (
    <Screen>
      <ScreenHeader title={FIELD_LABELS[field]} subtitle="Profesyonel kayıt" onBack={() => router.back()} />
      <RegisterForm field={field} />
    </Screen>
  );
}
