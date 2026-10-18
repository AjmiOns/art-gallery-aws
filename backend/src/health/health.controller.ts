import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Utilisé par le health check de l'ALB : GET /api/health
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
