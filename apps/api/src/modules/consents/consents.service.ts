// KVKK rızaları — docs/kvkk/README.md
import { Inject, Injectable } from '@nestjs/common';
import { ageGroupOf } from '../../common/age.js';
import { forbidden } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

// Rıza metinlerinin sürümleri. Metin değişince sürüm artırılır; böylece kimin hangi metne
// onay verdiği bilinir. (Metinler hukukçu tarafından yazılana kadar "taslak".)
export const CONSENT_VERSIONS = {
  terms: '2026-11-taslak',
  privacy_notice: '2026-11-taslak',
  health_data: '2026-11-taslak',
  marketing: '2026-11-taslak',
} as const;

export type ConsentType = keyof typeof CONSENT_VERSIONS;

// Kullanıcının sonradan verip geri çekebildiği rızalar.
// terms ve privacy_notice kayıt şartıdır; geri çekmek için hesap silinir.
export const OPTIONAL_CONSENTS = ['health_data', 'marketing'] as const;
export type OptionalConsentType = (typeof OPTIONAL_CONSENTS)[number];

@Injectable()
export class ConsentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Kayıt sırasında oluşturulacak rıza kayıtları
  registrationConsents(includeHealthData: boolean) {
    const types: ConsentType[] = ['terms', 'privacy_notice'];
    if (includeHealthData) types.push('health_data');
    return types.map((type) => ({ type, textVersion: CONSENT_VERSIONS[type] }));
  }

  async listActive(userId: string) {
    return this.prisma.consent.findMany({
      where: { userId, revokedAt: null },
      select: { type: true, textVersion: true, grantedAt: true },
      orderBy: { grantedAt: 'asc' },
    });
  }

  async hasActive(userId: string, type: ConsentType): Promise<boolean> {
    const consent = await this.prisma.consent.findFirst({
      where: { userId, type, revokedAt: null },
      select: { id: true },
    });
    return consent !== null;
  }

  async grant(userId: string, type: OptionalConsentType) {
    if (type === 'health_data') {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { birthDate: true },
      });
      if (ageGroupOf(user.birthDate) !== 'ADULT') {
        throw forbidden(
          'PARENTAL_CONSENT_REQUIRED',
          '18 yaşından küçükler için sağlık verisi rızası veli tarafından verilmelidir.',
        );
      }
    }

    if (!(await this.hasActive(userId, type))) {
      await this.prisma.consent.create({
        data: { userId, type, textVersion: CONSENT_VERSIONS[type] },
      });
    }
    return this.listActive(userId);
  }

  async revoke(userId: string, type: OptionalConsentType) {
    await this.prisma.consent.updateMany({
      where: { userId, type, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.listActive(userId);
  }
}
