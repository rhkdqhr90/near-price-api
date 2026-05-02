import { User } from '../entities/user.entity';

export interface RepresentativeBadgeView {
  type: string;
  name: string;
}

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
  representativeBadge: RepresentativeBadgeView | null;
  createdAt: Date;
  updatedAt: Date;

  static from(
    user: User,
    representativeBadge: RepresentativeBadgeView | null = null,
  ): MyProfileResponseDto {
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
    dto.representativeBadge = representativeBadge;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
