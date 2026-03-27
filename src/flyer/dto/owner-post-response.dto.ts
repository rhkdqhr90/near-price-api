import type { OwnerPost } from '../entities/owner-post.entity';

export class OwnerPostResponseDto {
  id: string;
  ownerName: string;
  badge: string;
  message: string;
  emoji: string;
  likeCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(post: OwnerPost): OwnerPostResponseDto {
    const dto = new OwnerPostResponseDto();
    dto.id = post.id;
    dto.ownerName = post.ownerName;
    dto.badge = post.badge;
    dto.message = post.message;
    dto.emoji = post.emoji;
    dto.likeCount = post.likeCount;
    dto.isActive = post.isActive;
    dto.createdAt = post.createdAt;
    dto.updatedAt = post.updatedAt;
    return dto;
  }
}
