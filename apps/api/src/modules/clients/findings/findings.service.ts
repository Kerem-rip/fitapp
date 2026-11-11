// Uzman inceleme özeti: kural motorunun çıktısını kalıcı maddelere çevirir ve uzmanın kararlarını (not, kapatma, görev) yönetir.
//
// Madde yaşam döngüsü:
//  - Kurallar bir madde bulursa OPEN olarak oluşur. Parmak izi (kural + dayanak değerleri) aynıysa tekrar oluşmaz.
//  - Dayanak değişip madde artık geçerli değilse OPEN/FOLLOW_UP madde otomatik SUPERSEDED olur; kapatılmış maddeler olduğu gibi kalır.
//  - Uzman not ekler, gerekçeyle kapatır (CLOSED), yeniden açar ya da takip görevine çevirir (FOLLOW_UP).
// Maddeler uzmana aittir; danışan görmez. Bir madde, gerektirdiği paylaşım kategorilerinden biri kapanırsa gizlenir.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { badRequest, conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { FindingStatus, SharedDataType } from '../../../generated/prisma/enums.js';
import { AccessService } from '../../relationships/access.service.js';
import { AnamnesisService } from '../anamnesis.service.js';
import { STANDARD_QUESTIONS } from '../intake-template.js';
import { kindsInCategory } from '../measurement-rules.js';
import { evaluate, type BasisRef, type Candidate, type RuleInput } from './rules.js';

export const FINDING_DECISIONS = ['EVALUATED', 'NOT_APPLICABLE', 'CLIENT_INFORMED', 'OTHER'] as const;
export type FindingDecision = (typeof FINDING_DECISIONS)[number];

// Kuralların baktığı kategoriler
export const REVIEW_CATEGORIES: readonly SharedDataType[] = ['WEIGHT', 'MEASUREMENTS', 'ANAMNESIS'];

const fingerprintOf = (c: Candidate) => createHash('sha1').update(`${c.ruleCode}|${c.key}`).digest('hex');
const covered = (categories: readonly string[], allowed: ReadonlySet<SharedDataType>) => categories.every((c) => allowed.has(c as SharedDataType));

interface Context {
  allowed: ReadonlySet<SharedDataType>;
  sharedUntil: Date | null;
}

const EVENT_SELECT = { id: true, kind: true, text: true, createdAt: true } as const;
const TASK_SELECT = { id: true, title: true, dueAt: true, status: true, doneAt: true } as const;

@Injectable()
export class FindingsService {
  private readonly log = new Logger(FindingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
  ) {}

  // ───────────── Üretim ─────────────

  private async inputs(clientId: string, ctx: Context): Promise<RuleInput> {
    const answers = ctx.allowed.has('ANAMNESIS') ? await this.anamnesis.currentAnswers(clientId, STANDARD_QUESTIONS.map((q) => q.key)) : new Map();
    const kinds = [...(ctx.allowed.has('WEIGHT') ? kindsInCategory('WEIGHT') : []), ...(ctx.allowed.has('MEASUREMENTS') ? kindsInCategory('MEASUREMENTS') : [])];
    const rows = kinds.length
      ? await this.prisma.measurement.findMany({
          where: { userId: clientId, kind: { in: kinds }, voidedAt: null },
          orderBy: { takenAt: 'desc' },
          take: 300,
          select: { id: true, kind: true, value: true, method: true, takenAt: true },
        })
      : [];
    return {
      now: new Date(),
      allowed: ctx.allowed,
      sharedUntil: ctx.sharedUntil,
      answers: new Map([...answers.entries()].map(([key, a]) => [key, { value: a.value as never, answeredAt: a.answeredAt }])),
      measurements: rows,
    };
  }

  // Kural sonuçlarını kayıtlı maddelerle eşitler
  async refresh(professionalId: string, clientId: string, ctx: Context): Promise<void> {
    const candidates = evaluate(await this.inputs(clientId, ctx)).map((c) => ({ ...c, fingerprint: fingerprintOf(c) }));
    const existing = await this.prisma.reviewFinding.findMany({
      where: { professionalId, clientId },
      select: { id: true, fingerprint: true, status: true, categories: true },
    });
    const byPrint = new Map(existing.map((f) => [f.fingerprint, f]));
    const current = new Set(candidates.map((c) => c.fingerprint));
    const now = new Date();

    const fresh = candidates.filter((c) => !byPrint.has(c.fingerprint));
    if (fresh.length > 0) {
      await this.prisma.reviewFinding.createMany({
        skipDuplicates: true,
        data: fresh.map((c) => ({
          professionalId,
          clientId,
          ruleCode: c.ruleCode,
          fingerprint: c.fingerprint,
          level: c.level,
          title: c.title,
          detail: c.detail,
          basis: c.basis as unknown as object,
          categories: c.categories,
        })),
      });
    }

    for (const c of candidates) {
      const stored = byPrint.get(c.fingerprint);
      if (!stored) continue;
      // Metin (ör. "31 gün") ve dayanak güncel kalsın; durum değişmez
      await this.prisma.reviewFinding.update({
        where: { id: stored.id },
        data: { lastSeenAt: now, level: c.level, title: c.title, detail: c.detail, basis: c.basis as unknown as object },
      });
      if (stored.status === 'SUPERSEDED') {
        await this.prisma.reviewFinding.update({ where: { id: stored.id }, data: { status: 'OPEN' } });
        await this.prisma.reviewFindingEvent.create({
          data: { findingId: stored.id, kind: 'REOPENED', text: 'Dayanak bilgi tekrar geçerli oldu.' },
        });
      }
    }

    // Artık geçerli olmayan açık maddeler (yalnızca bakabildiğimiz kategorilerdekiler)
    for (const f of existing) {
      if (current.has(f.fingerprint) || (f.status !== 'OPEN' && f.status !== 'FOLLOW_UP')) continue;
      if (!covered(f.categories, ctx.allowed)) continue;
      await this.prisma.reviewFinding.update({ where: { id: f.id }, data: { status: 'SUPERSEDED' } });
      await this.prisma.reviewFindingEvent.create({
        data: { findingId: f.id, kind: 'SUPERSEDED', text: 'Bilgi güncellendi; bu madde artık geçerli değil.' },
      });
    }
  }

  // Danışanın verisi değişince, aktif uzmanlarının maddelerini kayıt yazmadan tazeler. Hata, yazma işlemini bozmaz.
  async refreshForClient(clientId: string): Promise<void> {
    try {
      const relationships = await this.prisma.clientRelationship.findMany({
        where: { clientId, status: 'ACTIVE' },
        select: { professionalId: true },
      });
      for (const { professionalId } of relationships) {
        const ctx = await this.access.peek(professionalId, clientId, REVIEW_CATEGORIES);
        if (ctx.relationshipId) await this.refresh(professionalId, clientId, ctx);
      }
    } catch (e) {
      this.log.warn(`İnceleme maddeleri tazelenemedi: ${(e as Error).message}`);
    }
  }

  // ───────────── Okuma ─────────────

  // Uzmana gösterilir: bakış denetim kaydına yazılır. Danışanlık yoksa 403.
  async list(professionalId: string, clientId: string, view: 'open' | 'closed' | 'all') {
    const acc = await this.access.accessibleCategories(professionalId, clientId, REVIEW_CATEGORIES, { dedupeMinutes: 10 });
    await this.refresh(professionalId, clientId, acc);

    const statuses: FindingStatus[] = view === 'open' ? ['OPEN', 'FOLLOW_UP'] : view === 'closed' ? ['CLOSED'] : ['OPEN', 'FOLLOW_UP', 'CLOSED'];
    const rows = await this.prisma.reviewFinding.findMany({
      where: { professionalId, clientId, status: { in: statuses } },
      // Aynı anda oluşan maddelerin sırası her yüklemede değişmesin: başlık ve kimlik sabit ikinci ölçüt
      orderBy: [{ level: 'asc' }, { firstSeenAt: 'desc' }, { title: 'asc' }, { id: 'asc' }],
      include: { events: { orderBy: { createdAt: 'asc' }, select: EVENT_SELECT }, tasks: { orderBy: { createdAt: 'asc' }, select: TASK_SELECT } },
    });
    const items = rows
      .filter((f) => covered(f.categories, acc.allowed))
      .map((f) => ({
        id: f.id,
        ruleCode: f.ruleCode,
        level: f.level,
        title: f.title,
        detail: f.detail,
        basis: f.basis as unknown as BasisRef[],
        status: f.status,
        decision: f.decision,
        closedReason: f.closedReason,
        closedAt: f.closedAt,
        firstSeenAt: f.firstSeenAt,
        events: f.events,
        tasks: f.tasks,
      }));
    return { rulesStatus: 'UNREVIEWED' as const, counts: await this.counts(professionalId, clientId, acc.allowed), items };
  }

  // Açık madde sayıları (içerik yok)
  async counts(professionalId: string, clientId: string, allowed: ReadonlySet<SharedDataType>) {
    const rows = await this.prisma.reviewFinding.findMany({
      where: { professionalId, clientId, status: { in: ['OPEN', 'FOLLOW_UP'] } },
      select: { level: true, status: true, categories: true },
    });
    const visible = rows.filter((f) => covered(f.categories, allowed));
    const open = visible.filter((f) => f.status === 'OPEN');
    return {
      red: open.filter((f) => f.level === 'RED').length,
      yellow: open.filter((f) => f.level === 'YELLOW').length,
      green: open.filter((f) => f.level === 'GREEN').length,
      followUp: visible.filter((f) => f.status === 'FOLLOW_UP').length,
    };
  }

  // Panel için: aktif danışanların açık madde sayıları. Sadece sayı döner; bakış sayılmadığı için denetim kaydı yazılmaz.
  async overview(professionalId: string) {
    const relationships = await this.prisma.clientRelationship.findMany({
      where: { professionalId, status: 'ACTIVE' },
      select: { client: { select: { id: true, firstName: true, lastName: true, username: true } } },
    });
    const result = [];
    for (const { client } of relationships) {
      const ctx = await this.access.peek(professionalId, client.id, REVIEW_CATEGORIES);
      const counts = await this.counts(professionalId, client.id, ctx.allowed);
      const openTasks = await this.prisma.followUpTask.count({ where: { professionalId, clientId: client.id, status: 'OPEN' } });
      result.push({ client, ...counts, openTasks });
    }
    return result.sort((a, b) => b.red - a.red || b.yellow - a.yellow || b.openTasks - a.openTasks);
  }

  // ───────────── Uzmanın kararları ─────────────

  private async context(professionalId: string, clientId: string): Promise<Context> {
    const ctx = await this.access.peek(professionalId, clientId, REVIEW_CATEGORIES);
    if (!ctx.relationshipId) throw forbidden('NO_ACCESS', 'Bu danışan için işlem yapamazsın.');
    return ctx;
  }

  private async requireFinding(professionalId: string, clientId: string, id: string) {
    const ctx = await this.context(professionalId, clientId);
    const finding = await this.prisma.reviewFinding.findFirst({
      where: { id, professionalId, clientId },
      select: { id: true, status: true, categories: true, title: true },
    });
    if (!finding) throw notFound('FINDING_NOT_FOUND', 'Madde bulunamadı.');
    if (!covered(finding.categories, ctx.allowed)) throw forbidden('NO_ACCESS', 'Bu maddeye erişimin yok.');
    return finding;
  }

  async addNote(professionalId: string, clientId: string, id: string, text: string) {
    const finding = await this.requireFinding(professionalId, clientId, id);
    return this.prisma.reviewFindingEvent.create({
      data: { findingId: finding.id, kind: 'NOTE', text: text.trim(), byId: professionalId },
      select: EVENT_SELECT,
    });
  }

  // Uzman kararını ve gerekçesini kaydederek kapatır
  async close(professionalId: string, clientId: string, id: string, decision: FindingDecision, reason: string) {
    const finding = await this.requireFinding(professionalId, clientId, id);
    if (finding.status === 'CLOSED') throw conflict('ALREADY_CLOSED', 'Bu madde zaten kapatılmış.');
    if (finding.status === 'SUPERSEDED') throw conflict('SUPERSEDED', 'Bu madde artık geçerli değil.');
    const cleaned = reason.trim();
    if (cleaned.length < 3) throw badRequest('REASON_REQUIRED', 'Kararının gerekçesini yaz.');
    await this.prisma.$transaction([
      this.prisma.reviewFinding.update({ where: { id }, data: { status: 'CLOSED', decision, closedReason: cleaned, closedAt: new Date() } }),
      this.prisma.reviewFindingEvent.create({ data: { findingId: id, kind: 'CLOSED', text: `${decision}: ${cleaned}`, byId: professionalId } }),
    ]);
    return { id, status: 'CLOSED' as const };
  }

  async reopen(professionalId: string, clientId: string, id: string) {
    const finding = await this.requireFinding(professionalId, clientId, id);
    if (finding.status !== 'CLOSED') throw conflict('NOT_CLOSED', 'Sadece kapatılmış madde yeniden açılır.');
    await this.prisma.$transaction([
      this.prisma.reviewFinding.update({ where: { id }, data: { status: 'OPEN', decision: null, closedReason: null, closedAt: null } }),
      this.prisma.reviewFindingEvent.create({ data: { findingId: id, kind: 'REOPENED', text: 'Uzman yeniden açtı.', byId: professionalId } }),
    ]);
    return { id, status: 'OPEN' as const };
  }

  // Maddeden takip görevi açar; madde görev bitene kadar "takipte" olur
  async createTask(professionalId: string, clientId: string, id: string, input: { title: string; dueAt?: Date }) {
    const finding = await this.requireFinding(professionalId, clientId, id);
    if (finding.status === 'CLOSED' || finding.status === 'SUPERSEDED') throw conflict('NOT_OPEN', 'Kapalı bir madde için görev açılamaz.');
    const [task] = await this.prisma.$transaction([
      this.prisma.followUpTask.create({
        data: { professionalId, clientId, findingId: id, title: input.title.trim(), dueAt: input.dueAt },
        select: TASK_SELECT,
      }),
      this.prisma.reviewFinding.update({ where: { id }, data: { status: 'FOLLOW_UP' } }),
      this.prisma.reviewFindingEvent.create({ data: { findingId: id, kind: 'TASK_CREATED', text: input.title.trim(), byId: professionalId } }),
    ]);
    return task;
  }
}
