// Her modülün ihtiyaç duyduğu kimlik doğrulama parçaları: AuthGuard, şifre servisi, JWT.
// Global olduğu için diğer modüller içe aktarmadan @UseGuards(AuthGuard) kullanabilir.
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env.js';
import { AuthGuard } from './auth.guard.js';
import { PasswordService } from './password.service.js';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: env.jwtSecret,
      signOptions: { expiresIn: env.accessTokenTtlSec },
    }),
  ],
  providers: [AuthGuard, PasswordService],
  exports: [JwtModule, AuthGuard, PasswordService],
})
export class AuthCoreModule {}
