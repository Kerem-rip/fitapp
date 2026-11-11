// Uzmanın görüşme notları. Danışana gösterilmez; sadece yazan uzman okur.
// Yazmak için aktif danışanlık gerekir. Danışanlık bitince uzman kendi eski notlarını okumaya devam eder
// (bu sürenin ne kadar olacağı hukuki karar bekliyor).
import { Inject, Injectable } from '@nestjs/common';
import { forbidden } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class NotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async add(professionalId: string, clientId: string, text: string) {
    const active = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!active) throw forbidden('NO_ACCESS', 'Bu danışan için not ekleyemezsin.');
    return this.prisma.professionalNote.create({
      data: { professionalId, clientId, text: text.trim() },
      select: { id: true, text: true, createdAt: true },
    });
  }

  async list(professionalId: string, clientId: string, limit: number, before?: Date) {
    const ever = await this.prisma.clientRelationship.findFirst({
      where: { professionalId, clientId, acceptedAt: { not: null } },
      select: { id: true },
    });
    if (!ever) throw forbidden('NO_ACCESS', 'Bu danışanın notlarına erişimin yok.');
    return this.prisma.professionalNote.findMany({
      where: { professionalId, clientId, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, text: true, createdAt: true },
    });
  }
}
