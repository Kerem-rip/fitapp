// Veritabanı bağlantısı. Tüm modüller veritabanına bunun üzerinden erişir.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
