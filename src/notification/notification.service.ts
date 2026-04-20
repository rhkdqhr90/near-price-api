import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import {
  Notification,
  NotificationLinkType,
  NotificationType,
} from './entities/notification.entity';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  linkType?: NotificationLinkType | null;
  linkId?: string | null;
  imageUrl?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private messaging: admin.messaging.Messaging | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {
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

  // ─── FCM 전송 ─────────────────────────────────────────────────────────

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

  // ─── DB 저장 + FCM 동시 전송 ───────────────────────────────────────────

  /**
   * 단일 사용자에게 알림 저장 후 FCM 전송.
   * DB 저장은 동기적으로, FCM 전송은 실패해도 저장은 유지.
   */
  async createAndPush(
    userId: string,
    fcmToken: string | null | undefined,
    payload: NotificationPayload,
  ): Promise<Notification> {
    const entity = this.notificationRepository.create({
      user: { id: userId } as { id: string },
      type: payload.type,
      title: payload.title,
      body: payload.body,
      linkType: payload.linkType ?? null,
      linkId: payload.linkId ?? null,
      imageUrl: payload.imageUrl ?? null,
    });
    const saved = await this.notificationRepository.save(entity);

    if (fcmToken) {
      await this.sendToUser(fcmToken, payload.title, payload.body);
    }

    return saved;
  }

  /**
   * 다수 사용자 대상 — DB bulk insert + FCM multicast.
   * userTokenPairs: [{ userId, fcmToken }] 형태. fcmToken이 null이면 DB만 저장.
   * 반환: 실패한 fcmToken 목록(호출부에서 정리).
   */
  async createAndPushMany(
    userTokenPairs: { userId: string; fcmToken: string | null }[],
    payload: NotificationPayload,
  ): Promise<string[]> {
    if (userTokenPairs.length === 0) return [];

    const entities = userTokenPairs.map((p) =>
      this.notificationRepository.create({
        user: { id: p.userId } as { id: string },
        type: payload.type,
        title: payload.title,
        body: payload.body,
        linkType: payload.linkType ?? null,
        linkId: payload.linkId ?? null,
        imageUrl: payload.imageUrl ?? null,
      }),
    );

    try {
      await this.notificationRepository.save(entities, { chunk: 500 });
    } catch (err: unknown) {
      this.logger.error(
        'Notification bulk save failed',
        (err as Error)?.message,
      );
    }

    const tokens = userTokenPairs
      .map((p) => p.fcmToken)
      .filter((t): t is string => !!t && t.trim().length > 0);

    return await this.sendToMany(tokens, payload.title, payload.body);
  }

  // ─── 조회/수정/삭제 ───────────────────────────────────────────────────

  /**
   * 사용자 알림 목록 (cursor 기반).
   * cursor: 마지막 항목의 createdAt ISO 문자열.
   */
  async findByUser(
    userId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const where: Record<string, unknown> = { user: { id: userId } };
    if (options.cursor) {
      const cursorDate = new Date(options.cursor);
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = LessThan(cursorDate);
      }
    }

    const items = await this.notificationRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const last = items[limit - 1];
      nextCursor = last.createdAt.toISOString();
      items.splice(limit);
    }

    return { items, nextCursor };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    const notif = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!notif) throw new NotFoundException('알림을 찾을 수 없습니다.');
    if (notif.user?.id !== userId) throw new ForbiddenException();
    if (notif.isRead) return;
    notif.isRead = true;
    notif.readAt = new Date();
    await this.notificationRepository.save(notif);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async remove(id: string, userId: string): Promise<void> {
    const notif = await this.notificationRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!notif) throw new NotFoundException('알림을 찾을 수 없습니다.');
    if (notif.user?.id !== userId) throw new ForbiddenException();
    await this.notificationRepository.remove(notif);
  }
}
