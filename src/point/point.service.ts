import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  PointDirection,
  PointSourceType,
  PointTransaction,
  PointTransactionStatus,
} from './entities/point-transaction.entity';
import { PointWallet } from './entities/point-wallet.entity';
import { PointSummaryResponseDto } from './dto/point-summary-response.dto';
import {
  PointTransactionListResponseDto,
  PointTransactionResponseDto,
} from './dto/point-transaction-response.dto';
import { PointTransactionQueryDto } from './dto/point-transaction-query.dto';

const PRICE_CREATE_POINTS = 12;
const PRICE_DISPUTED_PENALTY = 2;
const PRICE_DISPUTED_PENALTY_CAP = 10;

@Injectable()
export class PointService {
  constructor(
    @InjectRepository(PointWallet)
    private readonly walletRepository: Repository<PointWallet>,
    @InjectRepository(PointTransaction)
    private readonly transactionRepository: Repository<PointTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getSummary(userId: string): Promise<PointSummaryResponseDto> {
    const wallet = await this.getOrCreateWallet(userId);

    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const monthStart = this.getMonthStart(now);

    const [weeklyNetPoints, monthlyNetPoints] = await Promise.all([
      this.getNetPointsSince(userId, weekStart),
      this.getNetPointsSince(userId, monthStart),
    ]);

    const dto = new PointSummaryResponseDto();
    dto.availablePoints = wallet.availablePoints;
    dto.pendingPoints = wallet.pendingPoints;
    dto.weeklyNetPoints = weeklyNetPoints;
    dto.monthlyNetPoints = monthlyNetPoints;
    dto.lifetimeEarned = wallet.lifetimeEarned;
    dto.lifetimeSpent = wallet.lifetimeSpent;
    dto.calculatedAt = now.toISOString();
    return dto;
  }

  async getTransactions(
    userId: string,
    query: PointTransactionQueryDto,
  ): Promise<PointTransactionListResponseDto> {
    const limit = query.limit ?? 20;

    let txQuery = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.user_id = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC')
      .addOrderBy('tx.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      txQuery = txQuery.andWhere('tx.createdAt < :cursor', {
        cursor: new Date(query.cursor),
      });
    }

    const rows = await txQuery.getMany();
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const cursorRow = rows[limit - 1];
      nextCursor = cursorRow.createdAt.toISOString();
      rows.splice(limit);
    }

    const items: PointTransactionResponseDto[] = rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      status: row.status,
      amount: row.amount,
      signedAmount:
        row.direction === PointDirection.EARN ||
        row.direction === PointDirection.ADJUST
          ? row.amount
          : -row.amount,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      createdAt: row.createdAt.toISOString(),
      effectiveAt: row.effectiveAt.toISOString(),
    }));

    return { items, nextCursor };
  }

  async rewardPriceCreate(
    userId: string,
    priceId: string,
    activityLat: number,
    activityLng: number,
  ): Promise<void> {
    await this.applyTransaction({
      userId,
      direction: PointDirection.EARN,
      amount: PRICE_CREATE_POINTS,
      sourceType: PointSourceType.PRICE_CREATE,
      sourceId: priceId,
      idempotencyKey: `price:create:${priceId}`,
      activityLat,
      activityLng,
      meta: null,
    });
  }

  async deductPriceDelete(
    userId: string,
    priceId: string,
    activityLat: number,
    activityLng: number,
  ): Promise<void> {
    const earnedTx = await this.transactionRepository.findOne({
      where: {
        user: { id: userId },
        sourceType: PointSourceType.PRICE_CREATE,
        sourceId: priceId,
        status: PointTransactionStatus.CONFIRMED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!earnedTx) {
      return;
    }

    await this.applyTransaction({
      userId,
      direction: PointDirection.REVOKE,
      amount: PRICE_CREATE_POINTS,
      sourceType: PointSourceType.PRICE_DELETE,
      sourceId: priceId,
      idempotencyKey: `price:delete:${priceId}`,
      activityLat,
      activityLng,
      meta: null,
    });
  }

  async deductPriceDisputed(
    userId: string,
    priceId: string,
    verificationId: string,
    activityLat: number,
    activityLng: number,
  ): Promise<void> {
    const idempotencyKey = `price:disputed:${verificationId}`;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PointTransaction, {
        where: { idempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        return;
      }

      let wallet = await manager.findOne(PointWallet, {
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = manager.create(PointWallet, {
          user: { id: userId } as User,
          availablePoints: 0,
          pendingPoints: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0,
        });
        wallet = await manager.save(wallet);
      }

      const alreadyDeductedRaw = await manager
        .createQueryBuilder(PointTransaction, 'tx')
        .select('COALESCE(SUM(tx.amount), 0)', 'sum')
        .where('tx.user_id = :userId', { userId })
        .andWhere('tx.sourceType = :sourceType', {
          sourceType: PointSourceType.PRICE_DISPUTED,
        })
        .andWhere('tx.sourceId = :sourceId', { sourceId: priceId })
        .andWhere('tx.status = :status', {
          status: PointTransactionStatus.CONFIRMED,
        })
        .getRawOne<{ sum: string }>();

      const alreadyDeducted = parseInt(alreadyDeductedRaw?.sum ?? '0', 10);
      const remainingCap = PRICE_DISPUTED_PENALTY_CAP - alreadyDeducted;
      const amount = Math.min(
        PRICE_DISPUTED_PENALTY,
        Math.max(remainingCap, 0),
        wallet.availablePoints,
      );

      if (amount <= 0) {
        return;
      }

      const tx = manager.create(PointTransaction, {
        user: { id: userId } as User,
        direction: PointDirection.DEDUCT,
        status: PointTransactionStatus.CONFIRMED,
        amount,
        sourceType: PointSourceType.PRICE_DISPUTED,
        sourceId: priceId,
        idempotencyKey,
        activityLat,
        activityLng,
        meta: {
          verificationId,
        },
      });

      await manager.save(tx);

      wallet.availablePoints -= amount;
      wallet.lifetimeSpent += amount;
      await manager.save(wallet);
    });
  }

  private async getOrCreateWallet(userId: string): Promise<PointWallet> {
    let wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });

    if (wallet) {
      return wallet;
    }

    wallet = this.walletRepository.create({
      user: { id: userId } as User,
      availablePoints: 0,
      pendingPoints: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
    });
    return await this.walletRepository.save(wallet);
  }

  private async getNetPointsSince(
    userId: string,
    since: Date,
  ): Promise<number> {
    const raw = await this.transactionRepository
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.direction IN ('earn','adjust') THEN tx.amount ELSE -tx.amount END), 0)`,
        'net',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.status = :status', {
        status: PointTransactionStatus.CONFIRMED,
      })
      .andWhere('tx.effectiveAt >= :since', { since })
      .getRawOne<{ net: string }>();

    return parseInt(raw?.net ?? '0', 10);
  }

  private getWeekStart(now: Date): Date {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getMonthStart(now: Date): Date {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private async applyTransaction(input: {
    userId: string;
    direction: PointDirection;
    amount: number;
    sourceType: PointSourceType;
    sourceId: string;
    idempotencyKey: string;
    activityLat: number;
    activityLng: number;
    meta: Record<string, unknown> | null;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PointTransaction, {
        where: { idempotencyKey: input.idempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        return;
      }

      let wallet = await manager.findOne(PointWallet, {
        where: { user: { id: input.userId } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        wallet = manager.create(PointWallet, {
          user: { id: input.userId } as User,
          availablePoints: 0,
          pendingPoints: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0,
        });
        wallet = await manager.save(wallet);
      }

      const applyAmount =
        input.direction === PointDirection.EARN ||
        input.direction === PointDirection.ADJUST
          ? input.amount
          : Math.min(wallet.availablePoints, input.amount);

      if (applyAmount <= 0) {
        return;
      }

      const tx = manager.create(PointTransaction, {
        user: { id: input.userId } as User,
        direction: input.direction,
        status: PointTransactionStatus.CONFIRMED,
        amount: applyAmount,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        activityLat: input.activityLat,
        activityLng: input.activityLng,
        meta: input.meta,
      });

      await manager.save(tx);

      if (
        input.direction === PointDirection.EARN ||
        input.direction === PointDirection.ADJUST
      ) {
        wallet.availablePoints += applyAmount;
        wallet.lifetimeEarned += applyAmount;
      } else {
        wallet.availablePoints -= applyAmount;
        wallet.lifetimeSpent += applyAmount;
      }

      await manager.save(wallet);
    });
  }
}
