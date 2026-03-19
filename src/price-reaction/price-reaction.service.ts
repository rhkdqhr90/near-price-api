import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';
import { AdminReportDto } from './dto/admin-report.dto';
import { ReactionResponseDto } from './dto/reaction-response.dto';
import {
  PriceReaction,
  PriceReactionType,
} from './entities/price-reaction.entity';

@Injectable()
export class PriceReactionService {
  constructor(
    @InjectRepository(PriceReaction)
    private readonly reactionRepository: Repository<PriceReaction>,

    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async confirm(priceId: string, userId: string): Promise<void> {
    const existing = await this.reactionRepository.findOne({
      where: { price: { id: priceId }, user: { id: userId } },
      relations: ['price', 'price.user'],
    });

    if (existing) {
      const priceOwnerId = existing.price.user?.id ?? null;

      if (existing.type === PriceReactionType.CONFIRM) {
        await this.reactionRepository.remove(existing);
      } else {
        existing.type = PriceReactionType.CONFIRM;
        existing.reason = null;
        await this.reactionRepository.save(existing);
      }

      if (priceOwnerId) await this.recalculateTrustScore(priceOwnerId);
      return;
    }

    const price = await this.priceRepository.findOne({
      where: { id: priceId },
      relations: ['user'],
    });
    if (!price) throw new NotFoundException('가격 정보가 없습니다.');

    try {
      await this.reactionRepository.save(
        this.reactionRepository.create({
          price,
          user: { id: userId } as User,
          type: PriceReactionType.CONFIRM,
          reason: null,
        }),
      );
    } catch (err: unknown) {
      // 동시 요청으로 인한 유니크 제약 위반: 이미 생성됨 → 무시
      if ((err as { code?: string })?.code === '23505') return;
      throw err;
    }

    if (price.user?.id) await this.recalculateTrustScore(price.user.id);
  }

  async report(priceId: string, userId: string, reason: string): Promise<void> {
    const existing = await this.reactionRepository.findOne({
      where: { price: { id: priceId }, user: { id: userId } },
      relations: ['price', 'price.user'],
    });

    if (existing) {
      if (existing.type === PriceReactionType.REPORT) {
        throw new ConflictException('이미 신고한 가격입니다.');
      }

      const priceOwnerId = existing.price.user?.id ?? null;
      existing.type = PriceReactionType.REPORT;
      existing.reason = reason;
      await this.reactionRepository.save(existing);

      if (priceOwnerId) await this.recalculateTrustScore(priceOwnerId);
      return;
    }

    const price = await this.priceRepository.findOne({
      where: { id: priceId },
      relations: ['user'],
    });
    if (!price) throw new NotFoundException('가격 정보가 없습니다.');

    try {
      await this.reactionRepository.save(
        this.reactionRepository.create({
          price,
          user: { id: userId } as User,
          type: PriceReactionType.REPORT,
          reason,
        }),
      );
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === '23505') {
        throw new ConflictException('이미 신고한 가격입니다.');
      }
      throw err;
    }

    if (price.user?.id) await this.recalculateTrustScore(price.user.id);
  }

  async getReactions(
    priceId: string,
    userId: string | null,
  ): Promise<ReactionResponseDto> {
    const [confirmCount, reportCount] = await Promise.all([
      this.reactionRepository.count({
        where: { price: { id: priceId }, type: PriceReactionType.CONFIRM },
      }),
      this.reactionRepository.count({
        where: { price: { id: priceId }, type: PriceReactionType.REPORT },
      }),
    ]);

    let myReaction: PriceReactionType | null = null;
    if (userId) {
      const existing = await this.reactionRepository.findOne({
        where: { price: { id: priceId }, user: { id: userId } },
      });
      if (existing) myReaction = existing.type;
    }

    return { confirmCount, reportCount, myReaction };
  }

  async findAllReports(): Promise<AdminReportDto[]> {
    const reactions = await this.reactionRepository.find({
      where: { type: PriceReactionType.REPORT },
      relations: ['user', 'price', 'price.product', 'price.store'],
      order: { createdAt: 'DESC' },
    });

    return reactions.map((r) => ({
      id: r.id,
      reason: r.reason ?? '',
      reporter: {
        id: r.user.id,
        nickname: r.user.nickname,
        email: r.user.email,
      },
      price: {
        id: r.price.id,
        amount: r.price.price,
        isActive: r.price.isActive,
        product: { name: r.price.product?.name ?? '' },
        store: { name: r.price.store?.name ?? '' },
      },
      createdAt: r.createdAt,
    }));
  }

  async recalculateTrustScore(targetUserId: string): Promise<void> {
    const result = await this.reactionRepository
      .createQueryBuilder('pr')
      .select(
        `COALESCE(SUM(CASE WHEN pr.type = 'confirm' THEN 1 WHEN pr.type = 'report' THEN -2 ELSE 0 END), 0)`,
        'score',
      )
      .innerJoin('pr.price', 'p')
      .innerJoin('p.user', 'u')
      .where('u.id = :targetUserId', { targetUserId })
      .andWhere('p.isActive = :isActive', { isActive: true })
      .getRawOne<{ score: string }>();

    const score = Math.max(0, parseInt(result?.score ?? '0', 10));
    await this.userRepository.update(
      { id: targetUserId },
      { trustScore: score },
    );
  }
}
