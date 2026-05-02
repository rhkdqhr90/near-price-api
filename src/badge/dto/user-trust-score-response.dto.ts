import { User } from '../../user/entities/user.entity';
import { UserTrustScore } from '../../trust-score/entities/user-trust-score.entity';

/**
 * 사용자 신뢰도 점수 응답 DTO.
 * `UserTrustScore` 행이 없는 신규 사용자는 기본값(50/50/0)을 노출한다.
 */
export class UserTrustScoreResponseDto {
  userId: string;
  trustScore: number;
  registrationScore: number;
  verificationScore: number;
  consistencyBonus: number;
  totalRegistrations: number;
  totalVerifications: number;
  calculatedAt: Date;

  static from(
    user: User,
    trustScore: UserTrustScore | null,
  ): UserTrustScoreResponseDto {
    const dto = new UserTrustScoreResponseDto();
    dto.userId = user.id;
    dto.trustScore = trustScore?.trustScore ?? user.trustScore ?? 0;
    dto.registrationScore = trustScore?.registrationScore ?? 50;
    dto.verificationScore = trustScore?.verificationScore ?? 50;
    dto.consistencyBonus = trustScore?.consistencyBonus ?? 0;
    dto.totalRegistrations = trustScore?.totalRegistrations ?? 0;
    dto.totalVerifications = trustScore?.totalVerifications ?? 0;
    dto.calculatedAt = trustScore?.calculatedAt ?? new Date();
    return dto;
  }
}
