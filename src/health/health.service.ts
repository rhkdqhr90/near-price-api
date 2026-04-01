import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private startTime = Date.now();

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async check() {
    const isDbConnected = await this.checkDatabase();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      status: isDbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime,
      ...(isProduction
        ? {}
        : { database: isDbConnected ? 'connected' : 'disconnected' }),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
