import { Notice } from '../entities/notice.entity';

export class NoticeResponseDto {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(notice: Notice): NoticeResponseDto {
    const dto = new NoticeResponseDto();
    dto.id = notice.id;
    dto.title = notice.title;
    dto.content = notice.content;
    dto.isActive = notice.isActive;
    dto.isPinned = notice.isPinned;
    dto.createdAt = notice.createdAt;
    dto.updatedAt = notice.updatedAt;
    return dto;
  }
}
