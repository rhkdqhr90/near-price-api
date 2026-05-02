import { BadgeCategory } from '../entities/badge-definition.entity';

export class BadgeItemDto {
  type: string;
  name: string;
  icon: string;
  category: BadgeCategory;
}

export class BadgeProgressDto {
  type: string;
  name: string;
  icon: string;
  category: BadgeCategory;
  current: number;
  threshold: number;
  progressPercent: number;
}

export class UserBadgesResponseDto {
  earned: BadgeItemDto[];
  progress: BadgeProgressDto[];

  static from(
    earned: BadgeItemDto[],
    progress: BadgeProgressDto[],
  ): UserBadgesResponseDto {
    const dto = new UserBadgesResponseDto();
    dto.earned = earned;
    dto.progress = progress;
    return dto;
  }

  static empty(): UserBadgesResponseDto {
    return UserBadgesResponseDto.from([], []);
  }
}
