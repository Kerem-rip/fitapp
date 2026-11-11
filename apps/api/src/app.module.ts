// Ana modül: tüm özellik modülleri buraya eklenir.
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { AuthCoreModule } from './modules/auth/auth-core.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConsentsModule } from './modules/consents/consents.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RegistrationModule } from './modules/registration/registration.module.js';
import { RelationshipsModule } from './modules/relationships/relationships.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // Genel istek sınırı: IP başına dakikada 120 istek
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthCoreModule,
    EmailModule,
    FilesModule,
    HealthModule,
    AuthModule,
    RegistrationModule,
    ApplicationsModule,
    AdminModule,
    UsersModule,
    ConsentsModule,
    RelationshipsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
