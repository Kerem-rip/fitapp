// Beslenme planı: uzman taslak hazırlar, kontrol eder, ONAYLAR; onaylanınca danışana yayınlanır.
// Onaylanmış sürümler değiştirilmez. Düzenleme yeni taslakla yapılır; her onay yeni bir sürüm numarası alır.
// Danışan yalnızca yayındaki sürümde uzmanın tanımladığı alternatiflerden seçer.
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AccessService } from '../../relationships/access.service.js';
import { ConsentsService } from '../../consents/consents.service.js';
import { AnamnesisService } from '../anamnesis.service.js';
import { FindingsService } from '../findings/findings.service.js';
import { emptyPlan, type PlanContent } from './plan-content.js';
import { diffPlans } from './plan-diff.js';
import { checkPlan, findConflicts, type AllergyInfo } from './plan-rules.js';

// Onay öncesi, uzmanın bilerek geçmesi gereken uyarıların geldiği kurallar
const WARNING_RULES = ['R-EATING-DISORDER', 'Y-PREGNANCY', 'Y-CONDITIONS', 'Y-MEDICATIONS', 'Y-ANAMNESIS-MISSING'] as const;

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

const isDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};
const MAX_CHOICE_DAYS = 7;

@Injectable()
export class PlansService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  // ───────────── Uzman: erişim ─────────────

  // Yazma işlemleri aktif danışanlık ister
  private async requireActive(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, status: 'ACTIVE' }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışan için plan işlemi yapamazsın.');
  }

  // Uzmanın kendi hazırladığı planı (geçmiş dahil) okuması: danışanlık bir kez kabul edilmişse yeterlidir
  private async requireEver(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, acceptedAt: { not: null } }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışanın planına erişimin yok.');
  }

  private findPlan(professionalId: string, clientId: string) {
    return this.prisma.nutritionPlan.findUnique({ where: { professionalId_clientId: { professionalId, clientId } }, select: { id: true } });
  }

  private async requirePlanWithDraft(professionalId: string, clientId: string) {
    await this.requireActive(professionalId, clientId);
    const plan = await this.findPlan(professionalId, clientId);
    const draft = plan ? await this.prisma.planVersion.findFirst({ where: { planId: plan.id, status: 'DRAFT' } }) : null;
    if (!plan || !draft) throw notFound('NO_DRAFT', 'Açık bir plan taslağı yok.');
    return { plan, draft };
  }

  // ───────────── Uzman: okuma ─────────────

  async overview(professionalId: string, clientId: string) {
    await this.requireEver(professionalId, clientId);
    const plan = await this.findPlan(professionalId, clientId);
    if (!plan) return { planId: null, published: null, draft: null, versions: [], openPlanFindings: 0 };

    const versions = await this.prisma.planVersion.findMany({
      where: { planId: plan.id },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      include: { plan: false },
    });
    const approvers = await this.prisma.user.findMany({
      where: { id: { in: versions.flatMap((v) => (v.approvedById ? [v.approvedById] : [])) } },
      select: { id: true, firstName: true, lastName: true, username: true },
    });
    const approverName = (id: string | null) => {
      const u = approvers.find((a) => a.id === id);
      return u ? nameOf(u) : null;
    };

    const numbered = versions.filter((v) => v.number !== null);
    const history = numbered.map((v, i) => ({
      number: v.number!,
      status: v.status,
      approvedAt: v.approvedAt,
      approvedBy: approverName(v.approvedById),
      changeNote: v.changeNote,
      basedOnNumber: v.basedOnNumber,
      summary: diffPlans(i === 0 ? null : (numbered[i - 1]!.content as unknown as PlanContent), v.content as unknown as PlanContent),
    }));
    const published = versions.find((v) => v.status === 'APPROVED');
    const draft = versions.find((v) => v.status === 'DRAFT');
    const ctx = await this.access.peek(professionalId, clientId, ['ANAMNESIS']);
    const flagged = ctx.allowed.has('ANAMNESIS')
      ? await this.findings.openByRules(professionalId, clientId, ctx.allowed, ['R-PLAN-ALLERGEN'])
      : [];

    return {
      planId: plan.id,
      published: published
        ? {
            number: published.number!,
            approvedAt: published.approvedAt,
            approvedBy: approverName(published.approvedById),
            changeNote: published.changeNote,
            content: published.content as unknown as PlanContent,
          }
        : null,
      draft: draft
        ? { content: draft.content as unknown as PlanContent, changeNote: draft.changeNote, basedOnNumber: draft.basedOnNumber, updatedAt: draft.updatedAt }
        : null,
      versions: history.reverse(),
      // Yayındaki planda alerjenle çakışan, henüz ele alınmamış madde sayısı
      openPlanFindings: flagged.length,
    };
  }

  async version(professionalId: string, clientId: string, number: number) {
    await this.requireEver(professionalId, clientId);
    const plan = await this.findPlan(professionalId, clientId);
    const v = plan ? await this.prisma.planVersion.findFirst({ where: { planId: plan.id, number } }) : null;
    if (!v) throw notFound('VERSION_NOT_FOUND', 'Sürüm bulunamadı.');
    const previous = await this.prisma.planVersion.findFirst({ where: { planId: plan!.id, number: { lt: number } }, orderBy: { number: 'desc' } });
    return {
      number,
      status: v.status,
      approvedAt: v.approvedAt,
      changeNote: v.changeNote,
      basedOnNumber: v.basedOnNumber,
      content: v.content as unknown as PlanContent,
      summary: diffPlans(previous ? (previous.content as unknown as PlanContent) : null, v.content as unknown as PlanContent),
    };
  }

  // ───────────── Uzman: taslak ─────────────

  // Taslak başlatır: sıfırdan, yayındaki sürümden ya da verilen içerikle (ör. örnek menüden)
  async createDraft(professionalId: string, clientId: string, options: { content?: PlanContent; fromPublished?: boolean }) {
    await this.requireActive(professionalId, clientId);
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId: professionalId }, select: { type: true, verification: true } });
    if (!profile || profile.verification !== 'APPROVED' || profile.type !== 'DIETITIAN') {
      throw forbidden('NOT_A_DIETITIAN', 'Beslenme planı sadece onaylı diyetisyenler tarafından hazırlanır.');
    }
    const plan = await this.prisma.nutritionPlan.upsert({
      where: { professionalId_clientId: { professionalId, clientId } },
      create: { professionalId, clientId },
      update: {},
      select: { id: true },
    });
    if (await this.prisma.planVersion.findFirst({ where: { planId: plan.id, status: 'DRAFT' }, select: { id: true } })) {
      throw conflict('DRAFT_EXISTS', 'Zaten açık bir taslağın var; onu düzenle veya sil.');
    }
    const published = await this.prisma.planVersion.findFirst({ where: { planId: plan.id, status: 'APPROVED' } });
    let content: PlanContent;
    if (options.content) content = options.content;
    else if (options.fromPublished) {
      if (!published) throw conflict('NO_PUBLISHED', 'Yayında bir plan yok.');
      content = published.content as unknown as PlanContent;
    } else content = emptyPlan();

    const draft = await this.prisma.planVersion.create({
      data: { planId: plan.id, status: 'DRAFT', content: content as unknown as object, basedOnNumber: published?.number ?? null, createdById: professionalId },
      select: { id: true, content: true, basedOnNumber: true, updatedAt: true },
    });
    await this.prisma.planEvent.create({
      data: { planId: plan.id, versionId: draft.id, kind: 'DRAFT_CREATED', text: published ? `Sürüm ${published.number} temel alındı` : null, byId: professionalId },
    });
    return { content: draft.content as unknown as PlanContent, basedOnNumber: draft.basedOnNumber, updatedAt: draft.updatedAt };
  }

  async saveDraft(professionalId: string, clientId: string, content: PlanContent, changeNote?: string) {
    const { draft } = await this.requirePlanWithDraft(professionalId, clientId);
    const updated = await this.prisma.planVersion.update({
      where: { id: draft.id },
      data: { content: content as unknown as object, ...(changeNote !== undefined ? { changeNote: changeNote.trim() || null } : {}) },
      select: { content: true, changeNote: true, updatedAt: true },
    });
    return { content: updated.content as unknown as PlanContent, changeNote: updated.changeNote, updatedAt: updated.updatedAt };
  }

  async discardDraft(professionalId: string, clientId: string) {
    const { plan, draft } = await this.requirePlanWithDraft(professionalId, clientId);
    await this.prisma.$transaction([
      this.prisma.planVersion.delete({ where: { id: draft.id } }),
      this.prisma.planEvent.create({ data: { planId: plan.id, kind: 'DRAFT_DISCARDED', byId: professionalId } }),
    ]);
    return { discarded: true as const };
  }

  // ───────────── Uzman: kontrol ve onay ─────────────

  // Alerji bilgisini okur (uzmana gösterilen veri olduğu için denetim kaydına yazılır)
  private async allergyInfo(professionalId: string, clientId: string) {
    const acc = await this.access.accessibleCategories(professionalId, clientId, ['ANAMNESIS'], { dedupeMinutes: 10 });
    if (!acc.allowed.has('ANAMNESIS')) return { acc, allergy: { known: false, allergens: [] } satisfies AllergyInfo };
    const a = (await this.anamnesis.currentAnswers(clientId, ['std.allergies'])).get('std.allergies');
    const value = a?.value;
    const allergy: AllergyInfo = Array.isArray(value)
      ? { known: true, allergens: (value as string[]).filter((v) => v !== 'none') }
      : { known: false, allergens: [] };
    return { acc, allergy };
  }

  async check(professionalId: string, clientId: string) {
    const { draft } = await this.requirePlanWithDraft(professionalId, clientId);
    const { acc, allergy } = await this.allergyInfo(professionalId, clientId);
    await this.findings.refresh(professionalId, clientId, acc);
    const blockers = checkPlan(draft.content as unknown as PlanContent, allergy);
    const warnings = await this.findings.openByRules(professionalId, clientId, acc.allowed, WARNING_RULES);
    return { canApprove: blockers.length === 0, blockers, warnings };
  }

  // Taslağı onaylar ve danışana yayınlar. Engeller varsa onaylanmaz; uyarılar varsa uzmanın açıkça onaylaması gerekir.
  async approve(professionalId: string, clientId: string, input: { changeNote?: string; confirmWarnings: boolean }) {
    const { plan, draft } = await this.requirePlanWithDraft(professionalId, clientId);
    const result = await this.check(professionalId, clientId);
    if (!result.canApprove) {
      throw new ConflictException({ code: 'PLAN_BLOCKED', message: 'Plan onaylanamıyor; önce engelleri gider.', blockers: result.blockers });
    }
    if (result.warnings.length > 0 && !input.confirmWarnings) {
      throw new ConflictException({
        code: 'PLAN_WARNINGS',
        message: 'Planı onaylamadan önce uyarıları değerlendirdiğini onaylamalısın.',
        warnings: result.warnings,
      });
    }

    const last = await this.prisma.planVersion.aggregate({ where: { planId: plan.id }, _max: { number: true } });
    const number = (last._max.number ?? 0) + 1;
    const previous = await this.prisma.planVersion.findFirst({ where: { planId: plan.id, status: 'APPROVED' } });
    const summary = diffPlans(previous ? (previous.content as unknown as PlanContent) : null, draft.content as unknown as PlanContent);
    const note = (input.changeNote ?? draft.changeNote ?? '').trim() || null;
    const now = new Date();

    await this.prisma.$transaction([
      ...(previous
        ? [
            this.prisma.planVersion.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED' } }),
            this.prisma.planEvent.create({ data: { planId: plan.id, versionId: previous.id, kind: 'SUPERSEDED', text: `Sürüm ${number} yayınlandı`, byId: professionalId } }),
          ]
        : []),
      this.prisma.planVersion.update({
        where: { id: draft.id },
        data: {
          status: 'APPROVED',
          number,
          approvedById: professionalId,
          approvedAt: now,
          changeNote: note,
          acknowledged: result.warnings.length > 0 ? result.warnings.map((w) => w.title) : undefined,
        },
      }),
      this.prisma.planEvent.create({
        data: { planId: plan.id, versionId: draft.id, kind: 'APPROVED', text: [`Sürüm ${number}`, ...summary].join(' · '), byId: professionalId },
      }),
      this.prisma.notification.create({ data: { userId: clientId, type: 'plan_published', data: { planId: plan.id, number } } }),
    ]);
    // Yayındaki plana göre inceleme maddelerini tazele
    await this.findings.refreshForClient(clientId);
    return { number, approvedAt: now, summary };
  }

  // Danışanın seçimleri (öğün kayıtları kategorisi paylaşılıyorsa)
  async choices(professionalId: string, clientId: string, from: string, to: string) {
    await this.access.requireAccess(professionalId, clientId, 'MEALS', 'DATA_VIEWED', undefined, { dedupeMinutes: 10 });
    const plan = await this.findPlan(professionalId, clientId);
    if (!plan) return [];
    const rows = await this.prisma.planChoice.findMany({ where: { planId: plan.id, date: { gte: from, lte: to } }, orderBy: [{ date: 'desc' }, { mealId: 'asc' }] });
    const versions = await this.prisma.planVersion.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.versionId))] } }, select: { id: true, number: true, content: true } });
    return rows.map((r) => {
      const v = versions.find((x) => x.id === r.versionId);
      const content = v?.content as unknown as PlanContent | undefined;
      const meal = content?.meals.find((m) => m.id === r.mealId);
      return {
        date: r.date,
        mealId: r.mealId,
        mealName: meal?.name ?? 'Öğün',
        versionNumber: v?.number ?? null,
        options: r.optionIds.map((id) => ({ id, name: meal?.options.find((o) => o.id === id)?.name ?? 'Seçenek' })),
      };
    });
  }

  // ───────────── Danışan ─────────────

  async listForClient(clientId: string) {
    const rels = await this.prisma.clientRelationship.findMany({ where: { clientId, status: 'ACTIVE' }, select: { professionalId: true } });
    const plans = await this.prisma.nutritionPlan.findMany({
      where: { clientId, professionalId: { in: rels.map((r) => r.professionalId) }, versions: { some: { status: 'APPROVED' } } },
      select: {
        id: true,
        professional: { select: { firstName: true, lastName: true, username: true, professionalProfile: { select: { title: true } } } },
        versions: { where: { status: 'APPROVED' }, select: { number: true, approvedAt: true, content: true }, take: 1 },
      },
    });
    return plans.map((p) => {
      const v = p.versions[0]!;
      const content = v.content as unknown as PlanContent;
      return {
        planId: p.id,
        professional: { name: nameOf(p.professional), title: p.professional.professionalProfile?.title ?? null },
        number: v.number,
        approvedAt: v.approvedAt,
        title: content.title ?? null,
        mealCount: content.meals.length,
      };
    });
  }

  private async clientPlan(clientId: string, planId: string) {
    const plan = await this.prisma.nutritionPlan.findFirst({
      where: { id: planId, clientId },
      select: { id: true, professionalId: true, professional: { select: { firstName: true, lastName: true, username: true, professionalProfile: { select: { title: true } } } } },
    });
    const rel = plan ? await this.prisma.clientRelationship.findFirst({ where: { professionalId: plan.professionalId, clientId, status: 'ACTIVE' }, select: { id: true } }) : null;
    const published = plan && rel ? await this.prisma.planVersion.findFirst({ where: { planId: plan.id, status: 'APPROVED' } }) : null;
    if (!plan || !published) throw notFound('PLAN_NOT_FOUND', 'Plan bulunamadı.');
    return { plan, published, content: published.content as unknown as PlanContent };
  }

  // Danışanın KENDİ alerji beyanına göre çakışan seçenekler seçilemez gösterilir (uzman yeni sürüm yayınlayana kadar)
  private async blocked(clientId: string, content: PlanContent) {
    const a = (await this.anamnesis.currentAnswers(clientId, ['std.allergies'])).get('std.allergies');
    const allergens = Array.isArray(a?.value) ? (a!.value as string[]).filter((v) => v !== 'none') : [];
    return new Set(findConflicts(content, { known: !!a, allergens }).map((c) => c.optionId));
  }

  async viewForClient(clientId: string, planId: string, date: string) {
    if (!isDate(date)) throw badRequest('INVALID_DATE', 'Tarih YYYY-AA-GG biçiminde olmalı.');
    const { plan, published, content } = await this.clientPlan(clientId, planId);
    const blocked = await this.blocked(clientId, content);
    const rows = await this.prisma.planChoice.findMany({ where: { userId: clientId, planId, date } });
    const chosen = new Map(rows.map((r) => [r.mealId, r.optionIds]));
    return {
      planId,
      professional: { name: nameOf(plan.professional), title: plan.professional.professionalProfile?.title ?? null },
      version: { number: published.number, approvedAt: published.approvedAt },
      date,
      title: content.title ?? null,
      targetKcal: content.targetKcal ?? null,
      notes: content.notes ?? null,
      anyBlocked: blocked.size > 0,
      meals: content.meals.map((m) => ({
        id: m.id,
        name: m.name,
        time: m.time ?? null,
        pick: m.pick,
        rule: m.rule ?? null,
        options: m.options.map((o) => ({
          id: o.id,
          name: o.name,
          portion: o.portion,
          kcal: o.kcal ?? null,
          allergens: o.allergens,
          note: o.note ?? null,
          blockedReason: blocked.has(o.id) ? 'Alerji bilgin güncellendi; bu seçenek diyetisyeninin incelemesini bekliyor.' : null,
        })),
        // Sadece hâlâ geçerli ve seçilebilir olanlar
        chosen: (chosen.get(m.id) ?? []).filter((id) => m.options.some((o) => o.id === id) && !blocked.has(id)),
      })),
    };
  }

  async setChoice(clientId: string, planId: string, date: string, mealId: string, optionIds: string[]) {
    if (!isDate(date)) throw badRequest('INVALID_DATE', 'Tarih YYYY-AA-GG biçiminde olmalı.');
    const day = Date.parse(`${date}T00:00:00Z`);
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (Math.abs(day - today) > MAX_CHOICE_DAYS * 86_400_000) throw badRequest('DATE_OUT_OF_RANGE', `Seçimi en fazla ${MAX_CHOICE_DAYS} gün öncesi veya sonrası için yapabilirsin.`);
    if (!(await this.consents.hasActive(clientId, 'health_data'))) {
      throw forbidden('HEALTH_CONSENT_REQUIRED', 'Seçim kaydetmek için önce Profil bölümünden sağlık verisi iznini vermelisin.');
    }

    const { published, content } = await this.clientPlan(clientId, planId);
    const meal = content.meals.find((m) => m.id === mealId);
    if (!meal) throw notFound('MEAL_NOT_FOUND', 'Öğün bulunamadı.');
    const ids = [...new Set(optionIds)];
    if (!ids.every((id) => meal.options.some((o) => o.id === id))) {
      throw badRequest('OPTION_NOT_ALLOWED', 'Bu seçenek bu öğün için tanımlı değil.');
    }
    if (ids.length > meal.pick) throw badRequest('TOO_MANY_OPTIONS', `Bu öğünde en fazla ${meal.pick} seçenek seçebilirsin.`);
    const blocked = await this.blocked(clientId, content);
    if (ids.some((id) => blocked.has(id))) {
      throw forbidden('OPTION_BLOCKED', 'Bu seçenek, alerji bilgin nedeniyle diyetisyeninin incelemesini bekliyor.');
    }

    const key = { userId_planId_date_mealId: { userId: clientId, planId, date, mealId } };
    if (ids.length === 0) {
      await this.prisma.planChoice.deleteMany({ where: { userId: clientId, planId, date, mealId } });
    } else {
      await this.prisma.planChoice.upsert({
        where: key,
        create: { userId: clientId, planId, versionId: published.id, date, mealId, optionIds: ids },
        update: { versionId: published.id, optionIds: ids },
      });
    }
    return { date, mealId, optionIds: ids };
  }
}
