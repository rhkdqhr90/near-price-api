import { User } from '../entities/user.entity';

export class UserResponseDto {
  id: string;
  email: string;
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
    dto.email = user.email;
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
