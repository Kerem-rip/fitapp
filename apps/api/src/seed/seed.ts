// Demo hesapları sunucuya yükler (gerçek test hesapları). Tekrar çalıştırılabilir.
// Kullanım: pnpm db:seed
// Bu hesaplar sadece geliştirme/demo içindir; yayında çalıştırılmaz.
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../common/password.js';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import type { RoleType } from '../generated/prisma/enums.js';

const DEMO_PASSWORD = 'Demo1234!';

interface SeedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'FEMALE' | 'MALE';
  roles: RoleType[];
  professional?: { type: 'DIETITIAN' | 'TRAINER' | 'GYM'; field: 'DIETITIAN' | 'TRAINER' | 'GYM_OWNER'; title: string; city: string; specialties: string[] };
}

// Kimlikler mobil demo verisindekilerle aynıdır
const USERS: SeedUser[] = [
  { id: 'acc-ayse', email: 'ayse@demo.test', username: 'ayse_k', firstName: 'Ayşe', lastName: 'Korkmaz', birthDate: '1998-03-15', gender: 'FEMALE', roles: ['USER'] },
  { id: 'acc-mert', email: 'mert@demo.test', username: 'mert_a', firstName: 'Mert', lastName: 'Aksoy', birthDate: '2011-06-20', gender: 'MALE', roles: ['USER'] },
  {
    id: 'acc-zeynep', email: 'zeynep@demo.test', username: 'dyt_zeynep', firstName: 'Zeynep', lastName: 'Arslan', birthDate: '1988-09-02', gender: 'FEMALE',
    roles: ['USER', 'DIETITIAN'],
    professional: { type: 'DIETITIAN', field: 'DIETITIAN', title: 'Diyetisyen', city: 'İstanbul', specialties: ['Kilo yönetimi', 'Sürdürülebilir beslenme'] },
  },
  {
    id: 'acc-burak', email: 'burak@demo.test', username: 'burak_pt', firstName: 'Burak', lastName: 'Yıldız', birthDate: '1992-01-18', gender: 'MALE',
    roles: ['USER', 'TRAINER'],
    professional: { type: 'TRAINER', field: 'TRAINER', title: 'Bağımsız eğitmen', city: 'Ankara', specialties: ['Kuvvet', 'Evde antrenman'] },
  },
  {
    id: 'acc-selim', email: 'selim@demo.test', username: 'selim_fit', firstName: 'Selim', lastName: 'Kaya', birthDate: '1985-11-30', gender: 'MALE',
    roles: ['USER', 'GYM_MANAGER'],
    professional: { type: 'GYM', field: 'GYM_OWNER', title: 'Spor salonu', city: 'İstanbul', specialties: ['Fitness', 'Pilates'] },
  },
  { id: 'acc-deniz', email: 'deniz@demo.test', username: 'deniz_pt', firstName: 'Deniz', lastName: 'Kaya', birthDate: '1996-05-09', gender: 'FEMALE', roles: ['USER', 'GYM_STAFF'] },
  // Yönetici: normal girişten giremez, gizli yönetici girişini kullanır
  { id: 'acc-yonetici', email: 'yonetici@demo.test', username: 'yonetici', firstName: 'Yönetici', lastName: 'Hesabı', birthDate: '1990-01-01', gender: 'MALE', roles: ['ADMIN'] },
];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });

async function main() {
  // Herkesçe bilinen şifreli hesaplar gerçek bir sunucuya hiç yüklenmemeli
  if (env.nodeEnv === 'production') {
    throw new Error('Demo hesapları yayın ortamına yüklenmez (NODE_ENV=production).');
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        username: u.username,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        birthDate: new Date(u.birthDate),
        gender: u.gender,
        deletionRequestedAt: null,
      },
      update: { passwordHash, deletionRequestedAt: null },
    });
    await prisma.userRole.createMany({ data: u.roles.map((role) => ({ userId: u.id, role })), skipDuplicates: true });
    await prisma.profile.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });

    if ((await prisma.consent.count({ where: { userId: u.id } })) === 0) {
      await prisma.consent.createMany({
        data: ['terms', 'privacy_notice'].map((type) => ({ userId: u.id, type, textVersion: '2026-11-taslak' })),
      });
    }

    // Ayşe demo danışandır: paylaşım akışını denemek için sağlık verisi izni baştan verilmiştir
    if (u.id === 'acc-ayse' && !(await prisma.consent.findFirst({ where: { userId: u.id, type: 'health_data', revokedAt: null } }))) {
      await prisma.consent.create({ data: { userId: u.id, type: 'health_data', textVersion: '2026-11-taslak' } });
    }

    if (u.professional) {
      const p = u.professional;
      await prisma.professionalProfile.upsert({
        where: { userId: u.id },
        create: { userId: u.id, type: p.type, title: p.title, city: p.city, specialties: p.specialties, verification: 'APPROVED', verifiedAt: new Date() },
        update: { verification: 'APPROVED' },
      });
      if ((await prisma.professionalApplication.count({ where: { userId: u.id } })) === 0) {
        await prisma.professionalApplication.create({
          data: { userId: u.id, field: p.field, status: 'APPROVED', details: { field: p.field, city: p.city }, reviewedAt: new Date() },
        });
      }
    }
  }
  console.log(`${USERS.length} demo hesabı hazır.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
