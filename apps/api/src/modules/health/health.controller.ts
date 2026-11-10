import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // GET /api/health → sunucu ayakta mı?
  @Get()
  check() {
    return { status: 'ok' };
  }
}
