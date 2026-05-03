import { User } from '../entities/user.entity';
import { RepresentativeBadgeDto } from '../../badge/dto/representative-badge.dto';

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
  representativeBadge: RepresentativeBadgeDto | null;
  /** 마지막 변경 시각. 앱이 1시간 쿨다운 카운트다운에 사용. 미설정이면 null. */
  representativeBadgeChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  static from(
    user: User,
    representativeBadge: RepresentativeBadgeDto | null = null,
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
    dto.representativeBadgeChangedAt = user.representativeBadgeChangedAt;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
