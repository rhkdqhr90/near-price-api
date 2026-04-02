import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';
import { AdminReportDto } from './dto/admin-report.dto';
import { ReactionResponseDto } from './dto/reaction-response.dto';
import {
  PriceReaction,
  PriceReactionType,
} from './entities/price-reaction.entity';
import { DB_ERROR_CODES } from '../common/constants/db-error-codes';

@Injectable()
export class PriceReactionService {
  constructor(
    @InjectRepository(PriceReaction)
    private readonly reactionRepository: Repository<PriceReaction>,

    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,

    private readonly dataSource: DataSource,
  ) {}

  async confirm(priceId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PriceReaction, {
        where: { price: { id: priceId }, user: { id: userId } },
        relations: ['price', 'price.user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        if (existing.price.user?.id === userId) {
          throw new ForbiddenException(
            '본인이 등록한 가격에는 반응할 수 없습니다.',
          );
        }
        if (existing.type === PriceReactionType.CONFIRM) {
          await manager.remove(existing);
        } else {
          existing.type = PriceReactionType.CONFIRM;
          existing.reason = null;
          await manager.save(existing);
        }
        return;
      }

      const price = await manager.findOne(Price, {
        where: { id: priceId },
        relations: ['user'],
      });
      if (!price) throw new NotFoundException('가격 정보가 없습니다.');

      if (price.user?.id === userId) {
        throw new ForbiddenException(
          '본인이 등록한 가격에는 반응할 수 없습니다.',
        );
      }

      try {
        await manager.save(
          manager.create(PriceReaction, {
            price,
            user: { id: userId } as User,
            type: PriceReactionType.CONFIRM,
            reason: null,
          }),
        );
      } catch (err: unknown) {
        // 동시 요청으로 인한 유니크 제약 위반: 이미 생성됨 → 무시
        if (
          (err as { code?: string })?.code === DB_ERROR_CODES.UNIQUE_VIOLATION
        )
          return;
        throw err;
      }
    });
  }

  async report(priceId: string, userId: string, reason: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PriceReaction, {
        where: { price: { id: priceId }, user: { id: userId } },
        relations: ['price', 'price.user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        if (existing.type === PriceReactionType.REPORT) {
          throw new ConflictException('이미 신고한 가격입니다.');
        }
        if (existing.price.user?.id === userId) {
          throw new ForbiddenException(
            '본인이 등록한 가격에는 반응할 수 없습니다.',
          );
        }
        existing.type = PriceReactionType.REPORT;
        existing.reason = reason;
        await manager.save(existing);
        return;
      }

      const price = await manager.findOne(Price, {
        where: { id: priceId },
        relations: ['user'],
      });
      if (!price) throw new NotFoundException('가격 정보가 없습니다.');

      if (price.user?.id === userId) {
        throw new ForbiddenException(
          '본인이 등록한 가격에는 반응할 수 없습니다.',
        );
      }

      try {
        await manager.save(
          manager.create(PriceReaction, {
            price,
            user: { id: userId } as User,
            type: PriceReactionType.REPORT,
            reason,
          }),
        );
      } catch (err: unknown) {
        if (
          (err as { code?: string })?.code === DB_ERROR_CODES.UNIQUE_VIOLATION
        ) {
          throw new ConflictException('이미 신고한 가격입니다.');
        }
        throw err;
      }
    });
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
}
