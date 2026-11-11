// Ölçüm türleri: birim, makul değer aralığı, uygun yöntemler ve hangi paylaşım kategorisine girdiği.
// Aralıklar KLİNİK eşik değildir; sadece yazım hatalarını (ör. 700 kg) yakalamak içindir.
import type { MeasurementKind, MeasurementMethod, SharedDataType } from '../../generated/prisma/enums.js';

export interface MeasurementSpec {
  unit: 'kg' | 'cm' | '%';
  min: number;
  max: number;
  methods: readonly MeasurementMethod[];
  category: SharedDataType;
}

const CIRCUMFERENCE: readonly MeasurementMethod[] = ['TAPE', 'SELF_REPORT', 'OTHER'];

export const MEASUREMENT_SPECS: Record<MeasurementKind, MeasurementSpec> = {
  WEIGHT: { unit: 'kg', min: 20, max: 400, methods: ['SCALE', 'SELF_REPORT', 'OTHER'], category: 'WEIGHT' },
  HEIGHT: { unit: 'cm', min: 100, max: 250, methods: ['TAPE', 'SELF_REPORT', 'OTHER'], category: 'MEASUREMENTS' },
  WAIST: { unit: 'cm', min: 40, max: 250, methods: CIRCUMFERENCE, category: 'MEASUREMENTS' },
  HIP: { unit: 'cm', min: 50, max: 250, methods: CIRCUMFERENCE, category: 'MEASUREMENTS' },
  CHEST: { unit: 'cm', min: 50, max: 250, methods: CIRCUMFERENCE, category: 'MEASUREMENTS' },
  ARM: { unit: 'cm', min: 10, max: 80, methods: CIRCUMFERENCE, category: 'MEASUREMENTS' },
  THIGH: { unit: 'cm', min: 20, max: 120, methods: CIRCUMFERENCE, category: 'MEASUREMENTS' },
  BODY_FAT_PERCENT: { unit: '%', min: 2, max: 70, methods: ['CALIPER', 'BIA', 'DEXA', 'SELF_REPORT', 'OTHER'], category: 'MEASUREMENTS' },
  MUSCLE_MASS: { unit: 'kg', min: 5, max: 150, methods: ['BIA', 'DEXA', 'OTHER'], category: 'MEASUREMENTS' },
  BODY_WATER_PERCENT: { unit: '%', min: 20, max: 80, methods: ['BIA', 'DEXA', 'OTHER'], category: 'MEASUREMENTS' },
};

export const MEASUREMENT_KINDS = Object.keys(MEASUREMENT_SPECS) as MeasurementKind[];

export const kindsInCategory = (category: SharedDataType): MeasurementKind[] =>
  MEASUREMENT_KINDS.filter((kind) => MEASUREMENT_SPECS[kind].category === category);

export const round1 = (value: number) => Math.round(value * 10) / 10;
