import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';

interface NotificationListResponse {
  items: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    linkType: string | null;
    linkId: string | null;
    imageUrl: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
  }>;
  nextCursor: string | null;
}

function toDto(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    linkType: n.linkType,
    linkId: n.linkId,
    imageUrl: n.imageUrl,
    isRead: n.isRead,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponse> {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const { items, nextCursor } = await this.notificationService.findByUser(
      user.userId,
      { limit: limitNum, cursor },
    );
    return { items: items.map(toDto), nextCursor };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(user.userId);
    return { count };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async readAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notificationService.markAllAsRead(user.userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notificationService.markAsRead(id, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notificationService.remove(id, user.userId);
  }
}
