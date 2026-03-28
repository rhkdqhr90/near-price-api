import { User } from '../entities/user.entity';

// Public profile DTO: 타인도 조회 가능하므로 민감 필드(email, fcmToken 등) 제외
export class UserResponseDto {
  id: string;
  nickname: string;
  latitude: number | null;
  longitude: number | null;
  trustScore: number;
  notifPriceChange: boolean;
  notifPromotion: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.nickname = user.nickname;
    dto.latitude = user.latitude;
    dto.longitude = user.longitude;
    dto.trustScore = user.trustScore;
    dto.notifPriceChange = user.notifPriceChange;
    dto.notifPromotion = user.notifPromotion;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
