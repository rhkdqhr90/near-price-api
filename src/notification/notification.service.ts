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
    } catch {
      this.logger.error('Failed to initialize Firebase Admin SDK');
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
    } catch {
      this.logger.warn('FCM send failed');
    }
  }
}
