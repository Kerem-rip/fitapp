// Egzersiz programı: antrenör taslak hazırlar, kontrol eder, ONAYLAR; onaylanınca danışana yayınlanır.
// Beslenme planıyla aynı kurallar: onaylanan sürüm değişmez, her onay yeni sürüm numarası alır, uyarılar açıkça onaylanır.
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { conflict, forbidden, notFound } from '../../../common/app-error.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AccessService } from '../../relationships/access.service.js';
import { AnamnesisService } from '../anamnesis.service.js';
import { FindingsService } from '../findings/findings.service.js';
import { emptyProgram, type ProgramContent } from './program-content.js';
import { checkProgram, diffPrograms, type HealthInfo } from './program-rules.js';

// Onay öncesi antrenörün bilerek geçmesi gereken uyarılar
const WARNING_RULES = ['R-PAIN-REPORTED', 'R-EATING-DISORDER', 'Y-PREGNANCY', 'Y-CONDITIONS', 'Y-MEDICATIONS', 'Y-ANAMNESIS-MISSING'] as const;

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

const asContent = (v: unknown) => v as ProgramContent;

@Injectable()
export class ProgramsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AnamnesisService) private readonly anamnesis: AnamnesisService,
    @Inject(FindingsService) private readonly findings: FindingsService,
  ) {}

  private async requireActive(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, status: 'ACTIVE' }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışan için program işlemi yapamazsın.');
  }

  private async requireEver(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({ where: { professionalId, clientId, acceptedAt: { not: null } }, select: { id: true } });
    if (!rel) throw forbidden('NO_ACCESS', 'Bu danışanın programına erişimin yok.');
  }

  private findProgram(professionalId: string, clientId: string) {
    return this.prisma.trainingProgram.findUnique({ where: { professionalId_clientId: { professionalId, clientId } }, select: { id: true } });
  }

  private async requireDraft(professionalId: string, clientId: string) {
    await this.requireActive(professionalId, clientId);
    const program = await this.findProgram(professionalId, clientId);
    const draft = program ? await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'DRAFT' } }) : null;
    if (!program || !draft) throw notFound('NO_DRAFT', 'Açık bir program taslağı yok.');
    return { program, draft };
  }

  // ───────────── Antrenör ─────────────

  async overview(professionalId: string, clientId: string) {
    await this.requireEver(professionalId, clientId);
    const program = await this.findProgram(professionalId, clientId);
    if (!program) return { programId: null, published: null, draft: null, versions: [] };
    const versions = await this.prisma.trainingProgramVersion.findMany({ where: { programId: program.id }, orderBy: [{ number: 'asc' }, { createdAt: 'asc' }] });
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
      summary: diffPrograms(i === 0 ? null : asContent(numbered[i - 1]!.content), asContent(v.content)),
    }));
    const published = versions.find((v) => v.status === 'APPROVED');
    const draft = versions.find((v) => v.status === 'DRAFT');
    return {
      programId: program.id,
      published: published
        ? { number: published.number!, approvedAt: published.approvedAt, approvedBy: approverName(published.approvedById), changeNote: published.changeNote, content: asContent(published.content) }
        : null,
      draft: draft ? { content: asContent(draft.content), changeNote: draft.changeNote, basedOnNumber: draft.basedOnNumber, updatedAt: draft.updatedAt } : null,
      versions: history.reverse(),
    };
  }

  async createDraft(professionalId: string, clientId: string, options: { content?: ProgramContent; fromPublished?: boolean }) {
    await this.requireActive(professionalId, clientId);
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId: professionalId }, select: { type: true, verification: true } });
    if (!profile || profile.verification !== 'APPROVED' || profile.type !== 'TRAINER') {
      throw forbidden('NOT_A_TRAINER', 'Egzersiz programı sadece onaylı antrenörler tarafından hazırlanır.');
    }
    const program = await this.prisma.trainingProgram.upsert({
      where: { professionalId_clientId: { professionalId, clientId } },
      create: { professionalId, clientId },
      update: {},
      select: { id: true },
    });
    if (await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'DRAFT' }, select: { id: true } })) {
      throw conflict('DRAFT_EXISTS', 'Zaten açık bir taslağın var; onu düzenle veya sil.');
    }
    const published = await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'APPROVED' } });
    let content: ProgramContent;
    if (options.content) content = options.content;
    else if (options.fromPublished) {
      if (!published) throw conflict('NO_PUBLISHED', 'Yayında bir program yok.');
      content = asContent(published.content);
    } else content = emptyProgram();

    const draft = await this.prisma.trainingProgramVersion.create({
      data: { programId: program.id, content: content as unknown as object, basedOnNumber: published?.number ?? null, createdById: professionalId },
      select: { id: true, content: true, basedOnNumber: true, updatedAt: true },
    });
    await this.prisma.programEvent.create({
      data: { programId: program.id, versionId: draft.id, kind: 'DRAFT_CREATED', text: published ? `Sürüm ${published.number} temel alındı` : null, byId: professionalId },
    });
    return { content: asContent(draft.content), basedOnNumber: draft.basedOnNumber, updatedAt: draft.updatedAt };
  }

  async saveDraft(professionalId: string, clientId: string, content: ProgramContent, changeNote?: string) {
    const { draft } = await this.requireDraft(professionalId, clientId);
    const updated = await this.prisma.trainingProgramVersion.update({
      where: { id: draft.id },
      data: { content: content as unknown as object, ...(changeNote !== undefined ? { changeNote: changeNote.trim() || null } : {}) },
      select: { content: true, changeNote: true, updatedAt: true },
    });
    return { content: asContent(updated.content), changeNote: updated.changeNote, updatedAt: updated.updatedAt };
  }

  async discardDraft(professionalId: string, clientId: string) {
    const { program, draft } = await this.requireDraft(professionalId, clientId);
    await this.prisma.$transaction([
      this.prisma.trainingProgramVersion.delete({ where: { id: draft.id } }),
      this.prisma.programEvent.create({ data: { programId: program.id, kind: 'DRAFT_DISCARDED', byId: professionalId } }),
    ]);
    return { discarded: true as const };
  }

  // Sağlık durumu ve hamilelik bilgisi (uzmana gösterilen veri olduğu için denetim kaydına yazılır)
  private async healthInfo(professionalId: string, clientId: string) {
    const acc = await this.access.accessibleCategories(professionalId, clientId, ['ANAMNESIS', 'WORKOUTS'], { dedupeMinutes: 10 });
    if (!acc.allowed.has('ANAMNESIS')) return { acc, health: { known: false } satisfies HealthInfo };
    const answers = await this.anamnesis.currentAnswers(clientId, ['std.conditions', 'std.pregnancy']);
    return { acc, health: { known: answers.has('std.conditions') && answers.has('std.pregnancy') } satisfies HealthInfo };
  }

  async check(professionalId: string, clientId: string) {
    const { draft } = await this.requireDraft(professionalId, clientId);
    const { acc, health } = await this.healthInfo(professionalId, clientId);
    await this.findings.refresh(professionalId, clientId, acc);
    const blockers = checkProgram(asContent(draft.content), health);
    const warnings = await this.findings.openByRules(professionalId, clientId, acc.allowed, WARNING_RULES);
    return { canApprove: blockers.length === 0, blockers, warnings };
  }

  async approve(professionalId: string, clientId: string, input: { changeNote?: string; confirmWarnings: boolean }) {
    const { program, draft } = await this.requireDraft(professionalId, clientId);
    const result = await this.check(professionalId, clientId);
    if (!result.canApprove) throw new ConflictException({ code: 'PROGRAM_BLOCKED', message: 'Program onaylanamıyor; önce engelleri gider.', blockers: result.blockers });
    if (result.warnings.length > 0 && !input.confirmWarnings) {
      throw new ConflictException({ code: 'PROGRAM_WARNINGS', message: 'Programı onaylamadan önce uyarıları değerlendirdiğini onaylamalısın.', warnings: result.warnings });
    }
    const last = await this.prisma.trainingProgramVersion.aggregate({ where: { programId: program.id }, _max: { number: true } });
    const number = (last._max.number ?? 0) + 1;
    const previous = await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'APPROVED' } });
    const summary = diffPrograms(previous ? asContent(previous.content) : null, asContent(draft.content));
    const note = (input.changeNote ?? draft.changeNote ?? '').trim() || null;
    const now = new Date();
    await this.prisma.$transaction([
      ...(previous
        ? [
            this.prisma.trainingProgramVersion.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED' } }),
            this.prisma.programEvent.create({ data: { programId: program.id, versionId: previous.id, kind: 'SUPERSEDED', text: `Sürüm ${number} yayınlandı`, byId: professionalId } }),
          ]
        : []),
      this.prisma.trainingProgramVersion.update({
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
      this.prisma.programEvent.create({ data: { programId: program.id, versionId: draft.id, kind: 'APPROVED', text: [`Sürüm ${number}`, ...summary].join(' · '), byId: professionalId } }),
      this.prisma.notification.create({ data: { userId: clientId, type: 'program_published', data: { programId: program.id, number } } }),
    ]);
    await this.findings.refreshForClient(clientId);
    return { number, approvedAt: now, summary };
  }

  // ───────────── Danışan ─────────────

  async listForClient(clientId: string) {
    const rels = await this.prisma.clientRelationship.findMany({ where: { clientId, status: 'ACTIVE' }, select: { professionalId: true } });
    const programs = await this.prisma.trainingProgram.findMany({
      where: { clientId, professionalId: { in: rels.map((r) => r.professionalId) }, versions: { some: { status: 'APPROVED' } } },
      select: {
        id: true,
        professional: { select: { firstName: true, lastName: true, username: true, professionalProfile: { select: { title: true } } } },
        versions: { where: { status: 'APPROVED' }, select: { number: true, approvedAt: true, content: true }, take: 1 },
      },
    });
    return programs.map((p) => {
      const v = p.versions[0]!;
      const content = asContent(v.content);
      return {
        programId: p.id,
        professional: { name: nameOf(p.professional), title: p.professional.professionalProfile?.title ?? null },
        number: v.number,
        approvedAt: v.approvedAt,
        title: content.title ?? null,
        dayCount: content.days.length,
      };
    });
  }

  // Danışanın görebildiği yayındaki program (aktif danışanlık gerekir)
  async publishedForClient(clientId: string, programId: string) {
    const program = await this.prisma.trainingProgram.findFirst({
      where: { id: programId, clientId },
      select: { id: true, professionalId: true, professional: { select: { firstName: true, lastName: true, username: true, professionalProfile: { select: { title: true } } } } },
    });
    const rel = program ? await this.prisma.clientRelationship.findFirst({ where: { professionalId: program.professionalId, clientId, status: 'ACTIVE' }, select: { id: true } }) : null;
    const published = program && rel ? await this.prisma.trainingProgramVersion.findFirst({ where: { programId: program.id, status: 'APPROVED' } }) : null;
    if (!program || !published) throw notFound('PROGRAM_NOT_FOUND', 'Program bulunamadı.');
    return { program, published, content: asContent(published.content) };
  }

  async viewForClient(clientId: string, programId: string) {
    const { program, published, content } = await this.publishedForClient(clientId, programId);
    return {
      programId,
      professional: { name: nameOf(program.professional), title: program.professional.professionalProfile?.title ?? null },
      version: { number: published.number, approvedAt: published.approvedAt },
      ...content,
    };
  }
}
