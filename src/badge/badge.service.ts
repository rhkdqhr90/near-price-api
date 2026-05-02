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

  /**
   * 사용자의 대표 뱃지를 설정하거나 해제한다.
   *
   * - `type === null` → 해제
   * - 알 수 없는 BadgeDefinition.id → 400
   * - 보유하지 않은 뱃지 → 400 (evaluator로 실시간 재평가)
   */
  async setRepresentativeBadge(
    userId: string,
    type: string | null,
  ): Promise<RepresentativeBadgeDto | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (type === null) {
      if (user.representativeBadgeId !== null) {
        user.representativeBadgeId = null;
        await this.userRepository.save(user);
      }
      return null;
    }

    const def = this.badgeRegistry.findById(type);
    if (!def) {
      throw new BadRequestException('알 수 없는 뱃지입니다');
    }

    const earnedIds = await this.badgeEvaluator.getEarnedBadgeIds(userId);
    if (!earnedIds.has(type)) {
      throw new BadRequestException('보유하지 않은 뱃지입니다');
    }

    user.representativeBadgeId = type;
    await this.userRepository.save(user);

    return RepresentativeBadgeDto.fromDefinition(def);
  }
}
