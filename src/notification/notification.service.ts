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
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.messaging = admin.messaging(app);
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async sendToUser(
    fcmToken: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.messaging || !fcmToken) return;

    try {
      await this.messaging.send({
        token: fcmToken,
        notification: { title, body },
      });
    } catch (error) {
      this.logger.warn(
        `FCM send failed for token ${fcmToken.slice(0, 10)}...`,
        error,
      );
    }
  }
}
