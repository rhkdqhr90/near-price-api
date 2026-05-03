import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';
import { User } from '../user/entities/user.entity';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeRegistryService } from './services/badge-registry.service';
import { BadgeRule } from './data/badge-definitions';
import { RepresentativeBadgeDto } from './dto/representative-badge.dto';
import { UserTrustScoreResponseDto } from './dto/user-trust-score-response.dto';

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserTrustScore)
    private readonly trustScoreRepository: Repository<UserTrustScore>,
    private readonly badgeEvaluator: BadgeEvaluatorService,
    private readonly badgeRegistry: BadgeRegistryService,
  ) {}

  async getUserTrustScore(userId: string): Promise<UserTrustScoreResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const trustScore = await this.trustScoreRepository.findOne({
      where: { user: { id: userId } },
    });

    return UserTrustScoreResponseDto.from(user, trustScore);
  }

  /** 1시간 쿨다운 검사 — 통과하지 못하면 BadRequest. */
  private assertCooldownPassed(lastChangedAt: Date | null): void {
    if (!lastChangedAt) return;
    const COOLDOWN_MS = 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(lastChangedAt).getTime();
    if (elapsed >= COOLDOWN_MS) return;
    const remainMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
    throw new BadRequestException(
      `대표 뱃지는 1시간에 한 번만 변경할 수 있습니다. (${remainMin}분 후 가능)`,
    );
  }

  /**
   * 사용자의 대표 뱃지를 설정하거나 해제한다.
   *
   * 검증 순서 (입력 → 쿨다운 → 권한):
   *  1. 동일 값 재설정 → idempotent no-op (쿨다운 무관)
   *  2. type !== null 이면 정의 존재 검증 (잘못된 ID는 즉시 거부, 쿨다운 메시지 우선 노출 방지)
   *  3. 1시간 쿨다운 검사
   *  4. type !== null 이면 보유 여부 검증 (DB 4쿼리 — 쿨다운 통과한 요청만 부담)
   *  5. 저장
   */
  async setRepresentativeBadge(
    userId: string,
    type: string | null,
  ): Promise<RepresentativeBadgeDto | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 1. 동일 값 재설정은 no-op (idempotent, 쿨다운 무관)
    if (user.representativeBadgeId === type) {
      if (type === null) return null;
      const def = this.badgeRegistry.findById(type);
      return def ? RepresentativeBadgeDto.fromDefinition(def) : null;
    }

    // 2. 정의 검증 — 잘못된 ID는 쿨다운 메시지보다 먼저 명확히 알린다
    let def: BadgeRule | undefined = undefined;
    if (type !== null) {
      def = this.badgeRegistry.findById(type);
      if (!def) {
        throw new BadRequestException('알 수 없는 뱃지입니다');
      }
    }

    // 3. 쿨다운 검사 (입력 자체는 유효함을 확인한 뒤)
    this.assertCooldownPassed(user.representativeBadgeChangedAt);

    // 4. 보유 검증 (해제 시 불필요)
    if (type !== null) {
      const earnedIds = await this.badgeEvaluator.getEarnedBadgeIds(userId);
      if (!earnedIds.has(type)) {
        throw new BadRequestException('보유하지 않은 뱃지입니다');
      }
    }

    // 5. 저장
    user.representativeBadgeId = type;
    user.representativeBadgeChangedAt = new Date();
    await this.userRepository.save(user);

    return def ? RepresentativeBadgeDto.fromDefinition(def) : null;
  }
}
