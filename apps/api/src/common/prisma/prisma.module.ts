import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// Global: her modül ayrıca içe aktarmadan PrismaService kullanabilir
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
