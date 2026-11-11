// Anamnez (sağlık öyküsü): standart sorular + uzmanın eklediği sorular. Yanıtlar sadece eklenir; geçmiş korunur.
// Uygulama yanıtlardan sağlık kararı üretmez; sadece uzmana gösterir ve eksikleri belirtir.
import { Inject, Injectable } from '@nestjs/common';
import { badRequest, conflict, forbidden, notFound } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { DataSource, IntakeQuestionType } from '../../generated/prisma/enums.js';
import { ConsentsService } from '../consents/consents.service.js';
import {
  customKey,
  CUSTOM_PREFIX,
  InvalidAnswerError,
  isCustomKey,
  normalizeAnswer,
  SECTION_LABELS,
  STANDARD_QUESTIONS,
  standardQuestion,
  type AnswerValue,
  type Choice,
  type QuestionDef,
} from './intake-template.js';

const MAX_CUSTOM_QUESTIONS = 30;

interface ResolvedQuestion extends QuestionDef {
  ownerId?: string;
  ownerName?: string;
}

const nameOf = (p: { firstName: string | null; lastName: string | null; username: string }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

@Injectable()
export class AnamnesisService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConsentsService) private readonly consents: ConsentsService,
  ) {}

  // ───────────── Sorular ─────────────

  // `ownerIds`: soruları gösterilecek uzmanlar (uzman kendi sorularını, danışan aktif uzmanlarının sorularını görür)
  async questions(ownerIds: string[]): Promise<ResolvedQuestion[]> {
    const custom =
      ownerIds.length === 0
        ? []
        : await this.prisma.intakeQuestion.findMany({
            where: { ownerId: { in: ownerIds }, active: true },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              ownerId: true,
              text: true,
              type: true,
              options: true,
              owner: { select: { firstName: true, lastName: true, username: true } },
            },
          });
    return [
      ...STANDARD_QUESTIONS,
      ...custom.map<ResolvedQuestion>((q) => ({
        key: customKey(q.id),
        section: 'CUSTOM',
        text: q.text,
        type: q.type,
        options: q.options.map((o) => ({ value: o, label: o })),
        ownerId: q.ownerId,
        ownerName: nameOf(q.owner),
      })),
    ];
  }

  private async resolve(key: string): Promise<ResolvedQuestion> {
    const standard = standardQuestion(key);
    if (standard) return standard;
    if (isCustomKey(key)) {
      const q = await this.prisma.intakeQuestion.findFirst({
        where: { id: key.slice(CUSTOM_PREFIX.length), active: true },
        select: { id: true, ownerId: true, text: true, type: true, options: true },
      });
      if (q) {
        return {
          key,
          section: 'CUSTOM',
          text: q.text,
          type: q.type,
          options: q.options.map<Choice>((o) => ({ value: o, label: o })),
          ownerId: q.ownerId,
        };
      }
    }
    throw notFound('QUESTION_NOT_FOUND', 'Soru bulunamadı.');
  }

  // ───────────── Yanıtlar ─────────────

  // Her sorunun en yeni yanıtı
  async currentAnswers(subjectId: string, keys?: string[]) {
    const rows = await this.prisma.intakeAnswer.findMany({
      where: { userId: subjectId, ...(keys ? { questionKey: { in: keys } } : {}) },
      distinct: ['questionKey'],
      orderBy: [{ questionKey: 'asc' }, { answeredAt: 'desc' }],
      select: {
        questionKey: true,
        value: true,
        source: true,
        answeredAt: true,
        answeredBy: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    return new Map(rows.map((r) => [r.questionKey, r]));
  }

  // Sorular ve güncel yanıtlar birlikte
  async view(subjectId: string, ownerIds: string[]) {
    const questions = await this.questions(ownerIds);
    const answers = await this.currentAnswers(subjectId, questions.map((q) => q.key));
    return questions.map((q) => {
      const a = answers.get(q.key);
      return {
        key: q.key,
        section: q.section,
        sectionLabel: SECTION_LABELS[q.section] ?? q.section,
        text: q.text,
        type: q.type,
        options: q.options ?? null,
        min: q.min ?? null,
        max: q.max ?? null,
        unit: q.unit ?? null,
        important: q.important ?? false,
        askedBy: q.ownerName ?? null,
        answer: a
          ? {
              value: a.value as AnswerValue,
              source: a.source,
              answeredAt: a.answeredAt,
              answeredBy: a.answeredBy ? nameOf(a.answeredBy) : null,
            }
          : null,
      };
    });
  }

  // Kişi kendisi yanıtlar (sağlık verisi rızası gerekir) ya da uzman danışan adına kaydeder (erişim kontrolü çağıranda)
  async setAnswer(
    subjectId: string,
    key: string,
    raw: unknown,
    actor: { id: string; source: Extract<DataSource, 'SELF' | 'PROFESSIONAL'> },
  ) {
    const question = await this.resolve(key);

    if (actor.source === 'SELF') {
      if (!(await this.consents.hasActive(subjectId, 'health_data'))) {
        throw forbidden('HEALTH_CONSENT_REQUIRED', 'Yanıt kaydetmek için önce Profil bölümünden sağlık verisi iznini vermelisin.');
      }
      if (question.ownerId) await this.requireActiveRelationship(question.ownerId, subjectId);
    } else if (question.ownerId && question.ownerId !== actor.id) {
      throw forbidden('NOT_YOUR_QUESTION', 'Bu soru başka bir uzmana ait.');
    }

    let value: AnswerValue;
    try {
      value = normalizeAnswer(question, raw);
    } catch (e) {
      if (e instanceof InvalidAnswerError) throw badRequest('INVALID_ANSWER', e.message);
      throw e;
    }

    const current = (await this.currentAnswers(subjectId, [key])).get(key);
    if (current && sameValue(current.value, value)) return { changed: false as const };

    await this.prisma.intakeAnswer.create({
      data: { userId: subjectId, questionKey: key, value, source: actor.source, answeredById: actor.id },
    });
    return { changed: true as const };
  }

  // Yanıtlanan / eksik standart sorular (uzmana "danışana sorulacaklar" için)
  async completeness(subjectId: string) {
    const answers = await this.currentAnswers(subjectId, STANDARD_QUESTIONS.map((q) => q.key));
    const missing = STANDARD_QUESTIONS.filter((q) => !answers.has(q.key)).map((q) => ({
      key: q.key,
      text: q.text,
      important: q.important ?? false,
    }));
    return { total: STANDARD_QUESTIONS.length, answered: STANDARD_QUESTIONS.length - missing.length, missing };
  }

  // Özet için: dikkat edilmesi gereken standart soruların güncel yanıtları
  async highlights(subjectId: string) {
    const important = STANDARD_QUESTIONS.filter((q) => q.important);
    const answers = await this.currentAnswers(subjectId, important.map((q) => q.key));
    return important.map((q) => {
      const a = answers.get(q.key);
      return {
        key: q.key,
        text: q.text,
        value: (a?.value as AnswerValue | undefined) ?? null,
        options: q.options ?? null,
        source: a?.source ?? null,
        answeredAt: a?.answeredAt ?? null,
      };
    });
  }

  // ───────────── Uzmanın kendi soruları ─────────────

  async addCustomQuestion(ownerId: string, input: { text: string; type: IntakeQuestionType; options: string[] }) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId: ownerId },
      select: { type: true, verification: true },
    });
    if (!profile || profile.verification !== 'APPROVED' || profile.type === 'GYM') {
      throw forbidden('NOT_A_PROFESSIONAL', 'Soru eklemek için onaylı bir diyetisyen veya eğitmen olmalısın.');
    }
    const isChoice = input.type === 'SINGLE_CHOICE' || input.type === 'MULTI_CHOICE';
    const options = [...new Set(input.options.map((o) => o.trim()).filter(Boolean))];
    if (isChoice && (options.length < 2 || options.length > 12)) {
      throw badRequest('INVALID_OPTIONS', 'Seçmeli sorular için 2 ile 12 arasında seçenek yaz.');
    }
    if (!isChoice && options.length > 0) throw badRequest('INVALID_OPTIONS', 'Bu soru türünde seçenek olmaz.');
    if ((await this.prisma.intakeQuestion.count({ where: { ownerId, active: true } })) >= MAX_CUSTOM_QUESTIONS) {
      throw conflict('TOO_MANY_QUESTIONS', `En fazla ${MAX_CUSTOM_QUESTIONS} özel soru ekleyebilirsin.`);
    }
    const q = await this.prisma.intakeQuestion.create({
      data: { ownerId, section: 'CUSTOM', text: input.text.trim(), type: input.type, options: isChoice ? options : [] },
      select: { id: true, text: true, type: true, options: true },
    });
    return { key: customKey(q.id), text: q.text, type: q.type, options: q.options };
  }

  // Soru kapatılır; verilmiş yanıtlar geçmişte kalır
  async deactivateCustomQuestion(ownerId: string, id: string) {
    const result = await this.prisma.intakeQuestion.updateMany({ where: { id, ownerId, active: true }, data: { active: false } });
    if (result.count === 0) throw notFound('QUESTION_NOT_FOUND', 'Soru bulunamadı.');
    return { id, active: false as const };
  }

  private async requireActiveRelationship(professionalId: string, clientId: string) {
    const rel = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!rel) throw notFound('QUESTION_NOT_FOUND', 'Soru bulunamadı.');
  }
}
