import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private messaging: admin.messaging.Messaging | null = null;

  constructor(private readonly configService: ConfigService) {
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );

    if (!serviceAccountJson) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM notifications disabled',
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        serviceAccountJson,
      ) as admin.ServiceAccount;
      // 기존 앱이 있으면 재사용, 없으면 새로 초기화 (테스트 환경에서의 중복 초기화 방지)
      const existingApp = admin.apps.find((a) => a?.name === 'nearprice');
      const app =
        existingApp ??
        admin.initializeApp(
          { credential: admin.credential.cert(serviceAccount) },
          'nearprice',
        );
      this.messaging = admin.messaging(app);
    } catch (err: unknown) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK',
        (err as Error)?.message,
      );
    }
  }

  async sendToUser(
    fcmToken: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.messaging || !fcmToken.trim()) return;

    try {
      await this.messaging.send({
        token: fcmToken,
        notification: { title, body },
      });
    } catch (err: unknown) {
      this.logger.warn('FCM send failed', (err as Error)?.message);
    }
  }

  /**
   * 다수 사용자에게 동일 알림 발송 (500개 청크 단위 multicast).
   * 실패 토큰은 반환하여 호출부에서 fcmToken 정리 가능.
   */
  async sendToMany(
    fcmTokens: string[],
    title: string,
    body: string,
  ): Promise<string[]> {
    if (!this.messaging) return [];
    const validTokens = fcmTokens.filter((t) => t.trim().length > 0);
    if (validTokens.length === 0) return [];

    const CHUNK_SIZE = 500;
    const failedTokens: string[] = [];

    for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
      const chunk = validTokens.slice(i, i + CHUNK_SIZE);
      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
        });

        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const code = res.error?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              failedTokens.push(chunk[idx]);
            }
            this.logger.warn(
              `FCM multicast failed for token index ${i + idx}`,
              res.error?.message,
            );
          }
        });
      } catch (err: unknown) {
        this.logger.error(
          `FCM multicast chunk failed (${i}~${i + chunk.length})`,
          (err as Error)?.message,
        );
      }
    }

    return failedTokens;
  }
}
