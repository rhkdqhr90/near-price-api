import { User } from '../entities/user.entity';

// 본인 프로필 DTO: GET /user/me 전용 — email, profileImageUrl 포함
export class MyProfileResponseDto {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  trustScore: number;
  notifPriceChange: boolean;
  notifPromotion: boolean;
  createdAt: Date;
  updatedAt: Date;

  static from(user: User): MyProfileResponseDto {
    const dto = new MyProfileResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.nickname = user.nickname;
    dto.profileImageUrl = user.profileImageUrl;
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
