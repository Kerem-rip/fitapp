// Danışan dosyası (profesyonel görünümü): özet ve zaman çizelgesi.
// Her şey AccessService'ten geçer; danışanın paylaşmadığı kategori dosyada hiç görünmez.
import { Inject, Injectable } from '@nestjs/common';
import { ageOn } from '../../common/age.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AccessService } from '../relationships/access.service.js';
import { AnamnesisService } from './anamnesis.service.js';
import {
  customKey,
  isCustomKey,
  standardQuestion,
  type AnswerValue,
  type Choice,
} from './intake-template.js';
import { kindsInCategory, MEASUREMENT_SPECS } from './measurement-rules.js';
import { MeasurementsService } from './measurements.service.js';

// Aynı uzmanın kısa sürede tekrar bakması denetim kaydını şişirmesin
const VIEW_DEDUPE_MINUTES = 10;

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

// Yanıtı okunur metne çevirir (seçenek etiketleri, birimli sayı)
function describe(value: AnswerValue, options?: readonly Choice[], unit?: string): string {
  const label = (v: string) => options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map(label).join(', ');
  if (typeof value === 'number') return unit ? `${value} ${unit}` : String(value);
  return label(value);
}

@Injectable()
export class ClientFileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MeasurementsService) private readonly measurements: MeasurementsService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
  ) {}

  async summary(professionalId: string, clientId: string) {
    const acc = await this.access.accessibleCategories(professionalId, clientId, ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS'], {
      dedupeMinutes: VIEW_DEDUPE_MINUTES,
    });
    const client = await this.prisma.user.findUniqueOrThrow({
      where: { id: clientId },
      select: { firstName: true, lastName: true, username: true, birthDate: true, gender: true },
    });

    const kinds = [...(acc.allowed.has('WEIGHT') ? kindsInCategory('WEIGHT') : []), ...(acc.allowed.has('MEASUREMENTS') ? kindsInCategory('MEASUREMENTS') : [])];
    const withAnamnesis = acc.allowed.has('ANAMNESIS');

    const [latest, completeness, highlights, notesCount] = await Promise.all([
      this.measurements.latestPerKind(clientId, kinds),
      withAnamnesis ? this.anamnesis.completeness(clientId) : null,
      withAnamnesis ? this.anamnesis.highlights(clientId) : null,
      this.prisma.professionalNote.count({ where: { professionalId, clientId } }),
    ]);

    return {
      client: { name: nameOf(client), username: client.username },
      sharing: { sharedData: acc.sharedData, sharedUntil: acc.sharedUntil, visible: [...acc.allowed] },
      // Yaş ve cinsiyet sağlık öyküsü kategorisine bağlıdır
      profile: withAnamnesis ? { ageYears: ageOn(client.birthDate), gender: client.gender } : null,
      measurements: latest,
      anamnesis: withAnamnesis ? { ...completeness, highlights } : null,
      notesCount,
    };
  }

  // Ölçümler, anamnez yanıtları ve uzmanın notları tek çizelgede (en yeniden eskiye)
  async timeline(professionalId: string, clientId: string, limit: number, before?: Date) {
    const acc = await this.access.accessibleCategories(professionalId, clientId, ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS'], {
      dedupeMinutes: VIEW_DEDUPE_MINUTES,
    });
    const kinds = [...(acc.allowed.has('WEIGHT') ? kindsInCategory('WEIGHT') : []), ...(acc.allowed.has('MEASUREMENTS') ? kindsInCategory('MEASUREMENTS') : [])];

    type Item =
      | { type: 'MEASUREMENT'; at: Date; id: string; kind: string; value: number; unit: string; method: string; source: string; voided: boolean; by: string | null }
      | { type: 'ANSWER'; at: Date; id: string; questionKey: string; question: string; display: string; source: string; by: string | null }
      | { type: 'NOTE'; at: Date; id: string; text: string };
    const items: Item[] = [];

    if (kinds.length > 0) {
      const rows = await this.prisma.measurement.findMany({
        where: { userId: clientId, kind: { in: kinds }, ...(before ? { takenAt: { lt: before } } : {}) },
        orderBy: { takenAt: 'desc' },
        take: limit,
        select: { id: true, kind: true, value: true, method: true, source: true, takenAt: true, voidedAt: true, enteredBy: { select: { firstName: true, lastName: true, username: true } } },
      });
      for (const r of rows) {
        items.push({
          type: 'MEASUREMENT',
          at: r.takenAt,
          id: r.id,
          kind: r.kind,
          value: r.value,
          unit: MEASUREMENT_SPECS[r.kind].unit,
          method: r.method,
          source: r.source,
          voided: r.voidedAt !== null,
          by: r.enteredBy ? nameOf(r.enteredBy) : null,
        });
      }
    }

    if (acc.allowed.has('ANAMNESIS')) {
      // Standart sorular + sadece bu uzmanın kendi soruları (başka uzmanın sorusunun yanıtı görünmez)
      const own = await this.prisma.intakeQuestion.findMany({ where: { ownerId: professionalId }, select: { id: true, text: true, type: true, options: true } });
      const ownKeys = own.map((q) => customKey(q.id));
      const rows = await this.prisma.intakeAnswer.findMany({
        where: {
          userId: clientId,
          OR: [{ questionKey: { startsWith: 'std.' } }, ...(ownKeys.length ? [{ questionKey: { in: ownKeys } }] : [])],
          ...(before ? { answeredAt: { lt: before } } : {}),
        },
        orderBy: { answeredAt: 'desc' },
        take: limit,
        select: { id: true, questionKey: true, value: true, source: true, answeredAt: true, answeredBy: { select: { firstName: true, lastName: true, username: true } } },
      });
      for (const r of rows) {
        const std = standardQuestion(r.questionKey);
        const custom = isCustomKey(r.questionKey) ? own.find((q) => customKey(q.id) === r.questionKey) : undefined;
        const options = std?.options ?? custom?.options.map<Choice>((o) => ({ value: o, label: o }));
        items.push({
          type: 'ANSWER',
          at: r.answeredAt,
          id: r.id,
          questionKey: r.questionKey,
          question: std?.text ?? custom?.text ?? 'Soru',
          display: describe(r.value as AnswerValue, options, std?.unit),
          source: r.source,
          by: r.answeredBy ? nameOf(r.answeredBy) : null,
        });
      }
    }

    const notes = await this.prisma.professionalNote.findMany({
      where: { professionalId, clientId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, text: true, createdAt: true },
    });
    for (const n of notes) items.push({ type: 'NOTE', at: n.createdAt, id: n.id, text: n.text });

    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    return items.slice(0, limit);
  }
}
