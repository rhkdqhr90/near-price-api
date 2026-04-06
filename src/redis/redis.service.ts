import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;

  constructor(private readonly configService: ConfigService) {}

  /** Redis 클라이언트가 연결되어 있는지 여부 */
  get available(): boolean {
    return this.client !== null;
  }

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url) {
      const env = this.configService.get<string>('NODE_ENV');
      if (env === 'production') {
        this.logger.error(
          'REDIS_URL not set in production — refresh token rotation and revocation DISABLED',
        );
      } else {
        this.logger.warn(
          'REDIS_URL not set — Redis disabled (development mode)',
        );
      }
      return;
    }

    try {
      this.client = createClient({ url }) as RedisClientType;
      this.client.on('error', (err: Error) =>
        this.logger.error('Redis error', err.message),
      );
      await this.client.connect();
      this.logger.log('Redis connected');
    } catch (err: unknown) {
      this.logger.error(
        'Redis connection failed — falling back to no-op',
        (err as Error)?.message,
      );
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  /** 값 저장 (TTL: 초 단위) */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  /** 값 조회 */
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return await this.client.get(key);
  }

  /** 키 삭제 */
  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }
}
