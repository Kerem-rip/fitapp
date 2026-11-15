// Vücut kompozisyonu TAHMİNİ (premium): çevre ölçülerinden yağ ve kas oranı. Ölçüm ya da tıbbi tanı DEĞİLDİR.
// Yöntem: ABD Donanması (U.S. Navy) çevre formülü. Hata payı birkaç yüzde puanıdır; sonuçlar her yerde "tahmini" diye gösterilir.
import type { Sex } from './nutrition';

export interface BodyInput {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  waistCm: number;
  neckCm: number;
  // Kadınlar (ve cinsiyet belirtmeyenler) için gerekli
  hipCm?: number | null;
}

export type BodyError = 'waist_neck' | 'hip_required' | 'range';

const log = Math.log10;

// Yağ oranı (%) ya da hata; makul olmayan değerlerde hata döner
export function navyBodyFatPercent(i: BodyInput): number | BodyError {
  if (!(i.heightCm >= 120 && i.heightCm <= 230 && i.waistCm >= 40 && i.waistCm <= 250 && i.neckCm >= 20 && i.neckCm <= 80)) return 'range';
  const male = (): number | BodyError => {
    if (i.waistCm <= i.neckCm) return 'waist_neck';
    return 495 / (1.0324 - 0.19077 * log(i.waistCm - i.neckCm) + 0.15456 * log(i.heightCm)) - 450;
  };
  const female = (): number | BodyError => {
    if (!i.hipCm || i.hipCm < 50 || i.hipCm > 250) return 'hip_required';
    if (i.waistCm + i.hipCm <= i.neckCm) return 'waist_neck';
    return 495 / (1.29579 - 0.35004 * log(i.waistCm + i.hipCm - i.neckCm) + 0.221 * log(i.heightCm)) - 450;
  };
  const raw = i.sex === 'male' ? male() : female();
  if (typeof raw === 'string') return raw;
  if (!Number.isFinite(raw)) return 'range';
  // Makul olmayan sonuçlar (ölçüm hatası) sınırlanmaz, reddedilir
  if (raw < 2 || raw > 60) return 'range';
  return Math.round(raw * 10) / 10;
}

export interface BodyComposition {
  bodyFatPercent: number;
  fatMassKg: number;
  leanMassKg: number;
  category: 'essential' | 'athletic' | 'fit' | 'average' | 'high';
  // Bel/boy oranı (genel bilgi; tanı değildir)
  waistToHeight: number;
}

// Yağ oranı aralıkları (ACE sınıflaması): cinsiyete göre
const CATEGORY_LIMITS: Record<'male' | 'female', [number, number, number, number]> = {
  female: [13, 20, 24, 31],
  male: [5, 13, 17, 24],
};

export function bodyFatCategory(sex: Sex, percent: number): BodyComposition['category'] {
  const [essential, athletic, fit, average] = CATEGORY_LIMITS[sex === 'male' ? 'male' : 'female'];
  if (percent <= essential) return 'essential';
  if (percent <= athletic) return 'athletic';
  if (percent <= fit) return 'fit';
  if (percent <= average) return 'average';
  return 'high';
}

export function estimateBodyComposition(i: BodyInput): BodyComposition | BodyError {
  const bf = navyBodyFatPercent(i);
  if (typeof bf === 'string') return bf;
  const fat = (i.weightKg * bf) / 100;
  return {
    bodyFatPercent: bf,
    fatMassKg: Math.round(fat * 10) / 10,
    leanMassKg: Math.round((i.weightKg - fat) * 10) / 10,
    category: bodyFatCategory(i.sex, bf),
    waistToHeight: Math.round((i.waistCm / i.heightCm) * 100) / 100,
  };
}
