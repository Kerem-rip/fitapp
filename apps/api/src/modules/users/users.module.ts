import { Module } from '@nestjs/common';
import { AccountPurgeService } from './account-purge.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AccountPurgeService],
  exports: [UsersService],
})
export class UsersModule {}
