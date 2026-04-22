import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const headers = this.getHeaders(req);

    const fromCloudflare = this.getSingleIp(headers['cf-connecting-ip']);
    if (fromCloudflare) {
      return Promise.resolve(fromCloudflare);
    }

    const fromForwarded = this.getSingleIp(headers['x-forwarded-for']);
    if (fromForwarded) {
      return Promise.resolve(fromForwarded);
    }

    const realIp = this.getSingleIp(headers['x-real-ip']);
    if (realIp) {
      return Promise.resolve(realIp);
    }

    const fallbackIp =
      typeof req?.ip === 'string' && req.ip.trim() ? req.ip.trim() : 'unknown';

    return Promise.resolve(fallbackIp);
  }

  private getHeaders(req: Record<string, any>): Record<string, unknown> {
    if (!req || typeof req !== 'object') {
      return {};
    }

    const candidate = (req as { headers?: unknown }).headers;
    if (!candidate || typeof candidate !== 'object') {
      return {};
    }

    return candidate as Record<string, unknown>;
  }

  private getSingleIp(value: unknown): string | null {
    if (Array.isArray(value)) {
      const first = value.find(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      return first ? this.normalizeIp(first) : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    return this.normalizeIp(value);
  }

  private normalizeIp(value: string): string | null {
    const first = value.split(',')[0]?.trim();
    if (!first) {
      return null;
    }
    return first;
  }
}
