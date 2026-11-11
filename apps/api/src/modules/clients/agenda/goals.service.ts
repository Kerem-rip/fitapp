// Danışan hedefleri: uzman belirler (sistem "uygun hedef" önermez). Ölçüm hedefinde başlangıç değeri son ölçümden alınır;
// ilerleme sadece ilgili ölçüm kategorisi paylaşılıyorsa gösterilir.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { GoalStatus, MeasurementKind } from '../../../generated/prisma/enums.js';
import { AccessService } from '../../relationships/access.service.js';
import { MEASUREMENT_SPECS } from '../measurement-rules.js';

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

export interface GoalInput {
  title: string;
  measurementKind?: MeasurementKind;
  targetValue?: number;
  targetDate?: Date;
  note?: string;
}

@Injectable()
export class GoalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  private latest(clientId: string, kind: MeasurementKind, after?: Date) {
    return this.prisma.measurement.findFirst({
      where: { userId: clientId, kind, voidedAt: null, ...(after ? { takenAt: { gt: after } } : {}) },
      orderBy: { takenAt: 'desc' },
      select: { id: true, value: true, takenAt: true, method: true },
    });
  }

  async create(professionalId: string, clientId: string, input: GoalInput) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, status: 'ACTIVE' }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışan için hedef belirleyemezsin.');

    let startValue: number | null = null;
    if (input.measurementKind) {
      const spec = MEASUREMENT_SPECS[input.measurementKind];
      if (input.targetValue === undefined) throw badRequest('TARGET_REQUIRED', 'Ölçüm hedefi için hedef değer yaz.');
      if (input.targetValue < spec.min || input.targetValue > spec.max) {
        throw badRequest('INVALID_VALUE', `Hedef değer ${spec.min} ile ${spec.max} ${spec.unit} arasında olmalı.`);
      }
      // Başlangıç değerini okumak, danışanın ölçüm verisine bakmaktır
      await this.access.requireAccess(professionalId, clientId, spec.category, 'DATA_VIEWED', { purpose: 'goal_start', kind: input.measurementKind }, { dedupeMinutes: 10 });
      startValue = (await this.latest(clientId, input.measurementKind))?.value ?? null;
    } else if (input.targetValue !== undefined) {
      throw badRequest('INVALID_VALUE', 'Ölçüm türü seçmeden hedef değer girilemez.');
    }
    if (input.targetDate && input.targetDate.getTime() < Date.now()) throw badRequest('INVALID_DATE', 'Hedef tarihi geçmişte olamaz.');

    return this.prisma.clientGoal.create({
      data: {
        professionalId,
        clientId,
        title: input.title.trim(),
        measurementKind: input.measurementKind ?? null,
        startValue,
        targetValue: input.targetValue ?? null,
        targetDate: input.targetDate ?? null,
        note: input.note?.trim() || null,
      },
    });
  }

  // Uzman görünümü: ilerleme sadece paylaşılan kategoriler için (bakış denetim kaydına yazılır)
  async listForProfessional(professionalId: string, clientId: string) {
    const ever = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, acceptedAt: { not: null } }, select: { id: true } });
    if (!ever) throw forbidden('NO_ACCESS', 'Bu danışanın hedeflerine erişimin yok.');
    const goals = await this.prisma.clientGoal.findMany({ where: { professionalId, clientId }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] });
    const kinds = goals.flatMap((g) => (g.measurementKind && g.status === 'ACTIVE' ? [g.measurementKind] : []));
    const categories = [...new Set(kinds.map((k) => MEASUREMENT_SPECS[k].category))];
    // Danışanlık bittiyse hedefler (uzmanın kendi kaydı) görünür ama ilerleme (danışanın verisi) gizlenir
    let allowed: ReadonlySet<string> = new Set();
    if (categories.length > 0 && (await this.access.peek(professionalId, clientId, categories)).relationshipId) {
      allowed = (await this.access.accessibleCategories(professionalId, clientId, categories, { dedupeMinutes: 10 })).allowed;
    }

    const result = [];
    for (const g of goals) {
      let progress = null;
      let hidden = false;
      if (g.measurementKind && g.status === 'ACTIVE') {
        if (allowed.has(MEASUREMENT_SPECS[g.measurementKind].category)) {
          const latest = await this.latest(clientId, g.measurementKind);
          const since = await this.prisma.measurement.count({ where: { userId: clientId, kind: g.measurementKind, voidedAt: null, takenAt: { gt: g.startDate } } });
          progress = {
            unit: MEASUREMENT_SPECS[g.measurementKind].unit,
            latestValue: latest?.value ?? null,
            latestAt: latest?.takenAt ?? null,
            measurementsSinceStart: since,
            // Hedefe kalan fark (pozitif: hedefin üstünde)
            remaining: latest && g.targetValue !== null ? Math.round((latest.value - g.targetValue) * 10) / 10 : null,
          };
        } else hidden = true;
      }
      result.push({ ...g, progress, progressHidden: hidden });
    }
    return result;
  }

  async setStatus(professionalId: string, id: string, status: GoalStatus, note?: string) {
    const goal = await this.prisma.clientGoal.findFirst({ where: { id, professionalId } });
    if (!goal) throw notFound('GOAL_NOT_FOUND', 'Hedef bulunamadı.');
    if (goal.status === status) throw conflict('SAME_STATUS', 'Hedef zaten bu durumda.');
    return this.prisma.clientGoal.update({
      where: { id },
      data: { status, closedAt: status === 'ACTIVE' ? null : new Date(), ...(note?.trim() ? { note: note.trim() } : {}) },
    });
  }

  // Danışan görünümü: kendi hedefleri (değerler zaten kendi verisi)
  async listForClient(clientId: string) {
    const rows = await this.prisma.clientGoal.findMany({
      where: { clientId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        measurementKind: true,
        startValue: true,
        targetValue: true,
        targetDate: true,
        startDate: true,
        professionalId: true,
        professional: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    const active = await this.prisma.clientRelationship.findMany({ where: { clientId, status: 'ACTIVE' }, select: { professionalId: true } });
    const ids = new Set(active.map((r) => r.professionalId));
    return rows
      .filter((g) => ids.has(g.professionalId))
      .map(({ professional, professionalId: _p, ...g }) => ({ ...g, unit: g.measurementKind ? MEASUREMENT_SPECS[g.measurementKind].unit : null, professional: nameOf(professional) }));
  }
}
