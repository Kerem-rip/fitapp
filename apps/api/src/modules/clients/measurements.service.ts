// Ölçümler (kilo, boy, çevre ölçüleri, vücut analizi). Her ölçümde kaynak, yöntem, tarih ve kimin girdiği tutulur.
// Ölçümler silinmez: yanlış giriş "geçersiz" işaretlenir ve geçmişte görünür kalır.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { DataSource, MeasurementKind, MeasurementMethod } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../consents/consents.service.js';
import { MEASUREMENT_SPECS, round1 } from './measurement-rules.js';

export interface MeasurementInput {
  kind: MeasurementKind;
  value: number;
  method: MeasurementMethod;
  deviceName?: string;
  takenAt?: Date;
  note?: string;
}

const SELECT = {
  id: true,
  kind: true,
  value: true,
  method: true,
  deviceName: true,
  source: true,
  takenAt: true,
  note: true,
  voidedAt: true,
  voidReason: true,
  createdAt: true,
  enteredBy: { select: { firstName: true, lastName: true, username: true } },
} as const;

type Row = {
  id: string;
  kind: MeasurementKind;
  value: number;
  method: MeasurementMethod;
  deviceName: string | null;
  source: DataSource;
  takenAt: Date;
  note: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
  enteredBy: { firstName: string | null; lastName: string | null; username: string } | null;
};

const present = ({ voidedAt, ...row }: Row) => ({
  ...row,
  unit: MEASUREMENT_SPECS[row.kind].unit,
  voided: voidedAt !== null,
  voidedAt,
});

export type MeasurementView = ReturnType<typeof present>;

const FUTURE_TOLERANCE_MS = 5 * 60_000;
const MAX_AGE_MS = 10 * 365 * 86_400_000;

@Injectable()
export class MeasurementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
  ) {}

  // Danışanın kendi ölçümü: sağlık verisi rızası gerekir. Uzman girişinin erişim kontrolü çağıran tarafta (AccessService) yapılır.
  async add(subjectId: string, actor: { id: string; source: Extract<DataSource, 'SELF' | 'PROFESSIONAL'> }, input: MeasurementInput) {
    if (actor.source === 'SELF' && !(await this.consents.hasActive(subjectId, 'health_data'))) {
      throw forbidden('HEALTH_CONSENT_REQUIRED', 'Ölçüm kaydetmek için önce Profil bölümünden sağlık verisi iznini vermelisin.');
    }
    const spec = MEASUREMENT_SPECS[input.kind];
    const value = round1(input.value);
    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      throw badRequest('INVALID_VALUE', `Değer ${spec.min} ile ${spec.max} ${spec.unit} arasında olmalı.`);
    }
    if (!spec.methods.includes(input.method)) {
      throw badRequest('INVALID_METHOD', 'Bu ölçüm için seçilen yöntem uygun değil.');
    }
    const now = Date.now();
    const takenAt = input.takenAt ?? new Date(now);
    if (takenAt.getTime() > now + FUTURE_TOLERANCE_MS) throw badRequest('INVALID_DATE', 'Ölçüm tarihi gelecekte olamaz.');
    if (takenAt.getTime() < now - MAX_AGE_MS) throw badRequest('INVALID_DATE', 'Ölçüm tarihi çok eski.');

    const row = await this.prisma.measurement.create({
      data: {
        userId: subjectId,
        kind: input.kind,
        value,
        method: input.method,
        deviceName: input.deviceName?.trim() || null,
        source: actor.source,
        enteredById: actor.id,
        takenAt,
        note: input.note?.trim() || null,
      },
      select: SELECT,
    });
    return present(row);
  }

  async list(subjectId: string, options: { kinds?: MeasurementKind[]; limit: number; includeVoided?: boolean }) {
    const rows = await this.prisma.measurement.findMany({
      where: {
        userId: subjectId,
        ...(options.kinds ? { kind: { in: options.kinds } } : {}),
        ...(options.includeVoided ? {} : { voidedAt: null }),
      },
      orderBy: { takenAt: 'desc' },
      take: options.limit,
      select: SELECT,
    });
    return rows.map(present);
  }

  // Her ölçüm türünün en yeni geçerli değeri
  async latestPerKind(subjectId: string, kinds: MeasurementKind[]) {
    if (kinds.length === 0) return [];
    const rows = await this.prisma.measurement.findMany({
      where: { userId: subjectId, kind: { in: kinds }, voidedAt: null },
      distinct: ['kind'],
      orderBy: [{ kind: 'asc' }, { takenAt: 'desc' }],
      select: SELECT,
    });
    return rows.map(present);
  }

  async find(subjectId: string, id: string) {
    const row = await this.prisma.measurement.findFirst({
      where: { id, userId: subjectId },
      select: { id: true, kind: true, source: true, enteredById: true, voidedAt: true },
    });
    if (!row) throw notFound('MEASUREMENT_NOT_FOUND', 'Ölçüm bulunamadı.');
    return row;
  }

  // Yanlış girişi geçersiz sayar. Kişi sadece kendi girdiklerini, uzman sadece kendi girdiklerini geçersiz kılabilir.
  async void(subjectId: string, id: string, actorId: string, reason?: string) {
    const row = await this.find(subjectId, id);
    if (row.voidedAt) throw conflict('ALREADY_VOIDED', 'Bu ölçüm zaten geçersiz sayılmış.');
    const actorIsSubject = actorId === subjectId;
    if (actorIsSubject ? row.source !== 'SELF' : row.enteredById !== actorId) {
      throw forbidden('NOT_YOURS', actorIsSubject ? 'Uzmanın girdiği ölçümü uzmanın kendisi düzeltmeli.' : 'Başkasının girdiği ölçümü geçersiz kılamazsın.');
    }
    const updated = await this.prisma.measurement.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: actorId, voidReason: reason?.trim() || null },
      select: SELECT,
    });
    return present(updated);
  }
}
