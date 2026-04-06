import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, DataSource } from 'typeorm';
import {
  PriceVerification,
  VerificationResult,
} from './entities/price-verification.entity';
import { CreateVerificationDto } from './dto/create-verification.dto';
import {
  VerificationDetailDto,
  VerificationResponseDto,
} from './dto/verification-response.dto';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';
import { PriceTrustScoreCalculator } from '../trust-score/services/price-trust-score.calculator';
import { NotificationService } from '../notification/notification.service';

const VERIFICATION_BADGE_THRESHOLDS: Record<number, string> = {
  10: '가격 확인러',
  50: '꼼꼼한 검증자',
  200: '검증 베테랑',
  500: '검증 마스터',
};

@Injectable()
export class PriceVerificationService {
  private readonly logger = new Logger(PriceVerificationService.name);

  constructor(
    @InjectRepository(PriceVerification)
    private verificationRepository: Repository<PriceVerification>,
    @InjectRepository(Price)
    private priceRepository: Repository<Price>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private trustScoreCalculator: PriceTrustScoreCalculator,
    private dataSource: DataSource,
    private notificationService: NotificationService,
  ) {}

  /**
   * 가격 검증 생성 (맞아요/달라요)
   */
  async createVerification(
    priceId: string,
    userId: string,
    createVerificationDto: CreateVerificationDto,
  ): Promise<VerificationResponseDto> {
    // 가격 데이터 조회
    const price = await this.priceRepository.findOne({
      where: { id: priceId },
      relations: ['user', 'product', 'store'],
    });

    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    // 본인이 등록한 가격은 검증할 수 없음
    // price.user가 null인 경우(계정 삭제 후 익명화) 는 검증 허용
    if (price.user !== null && price.user.id === userId) {
      throw new ForbiddenException('본인이 등록한 가격은 검증할 수 없습니다');
    }

    // 검증자 조회
    const verifier = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!verifier) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // "달라요" 검증의 경우 실제 가격 필수
    if (
      createVerificationDto.result === VerificationResult.DISPUTED &&
      !createVerificationDto.actualPrice
    ) {
      throw new BadRequestException(
        '"달라요" 검증 시 실제 가격을 입력해주세요',
      );
    }

    // 트랜잭션으로 검증과 새 가격 생성을 함께 처리
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 24시간 내 중복 검증 확인 (race condition 방지: SELECT FOR UPDATE)
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingVerification = await queryRunner.manager.findOne(
        PriceVerification,
        {
          where: {
            price: { id: priceId },
            verifier: { id: userId },
            createdAt: MoreThan(since24h),
          },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (existingVerification) {
        throw new ForbiddenException('24시간 이내에 이미 검증했습니다');
      }

      // 검증 생성
      const verification = queryRunner.manager.create(PriceVerification, {
        price,
        verifier,
        result: createVerificationDto.result,
        actualPrice: createVerificationDto.actualPrice || null,
        newPrice: null,
      });

      const savedVerification = await queryRunner.manager.save(verification);

      // "달라요"인 경우 새 가격 데이터 생성
      let newPrice: Price | null = null;
      if (
        createVerificationDto.result === VerificationResult.DISPUTED &&
        createVerificationDto.actualPrice
      ) {
        newPrice = queryRunner.manager.create(Price, {
          price: createVerificationDto.actualPrice,
          product: price.product,
          store: price.store,
          user: verifier,
          imageUrl: price.imageUrl,
          quantity: price.quantity,
          saleStartDate: price.saleStartDate,
          saleEndDate: price.saleEndDate,
          condition: price.condition,
        });

        const savedNewPrice = await queryRunner.manager.save(newPrice);
        savedVerification.newPrice = savedNewPrice;
        await queryRunner.manager.save(savedVerification);
      }

      // 가격 데이터의 검증 카운트 업데이트 (race condition 방지를 위한 atomic increment)
      const countUpdate =
        createVerificationDto.result === VerificationResult.CONFIRMED
          ? {
              verificationCount: () => 'verification_count + 1',
              confirmedCount: () => 'confirmed_count + 1',
            }
          : {
              verificationCount: () => 'verification_count + 1',
              disputedCount: () => 'disputed_count + 1',
            };

      await queryRunner.manager
        .createQueryBuilder()
        .update(Price)
        .set(countUpdate)
        .where('id = :id', { id: price.id })
        .execute();

      const result: VerificationResponseDto = {
        id: savedVerification.id,
        priceId: savedVerification.price.id,
        result: savedVerification.result,
        actualPrice: savedVerification.actualPrice,
        newPriceId: newPrice?.id || null,
        createdAt: savedVerification.createdAt,
      };

      await queryRunner.commitTransaction();

      // 가격 등록자에게 검증 알림 (fire-and-forget)
      this.sendVerificationNotification(
        price.user ?? null,
        createVerificationDto.result,
      ).catch((err: unknown) =>
        this.logger.warn('검증 알림 전송 실패', (err as Error)?.message),
      );

      // 검증자 뱃지 획득 확인 및 알림 (fire-and-forget)
      this.checkAndNotifyBadge(userId).catch((err: unknown) =>
        this.logger.warn('뱃지 알림 전송 실패', (err as Error)?.message),
      );

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async sendVerificationNotification(
    priceOwner: User | null,
    result: VerificationResult,
  ): Promise<void> {
    if (!priceOwner?.fcmToken) return;
    const label = result === VerificationResult.CONFIRMED ? '맞아요' : '달라요';
    await this.notificationService.sendToUser(
      priceOwner.fcmToken,
      '가격 검증 도착',
      `누군가 회원님의 가격에 "${label}"를 남겼어요.`,
    );
  }

  private async checkAndNotifyBadge(verifierId: string): Promise<void> {
    const count = await this.verificationRepository.count({
      where: { verifier: { id: verifierId } },
    });

    const badgeName = VERIFICATION_BADGE_THRESHOLDS[count];
    if (!badgeName) return;

    const verifier = await this.userRepository.findOne({
      where: { id: verifierId },
      select: ['id', 'fcmToken'],
    });
    if (!verifier?.fcmToken) return;

    await this.notificationService.sendToUser(
      verifier.fcmToken,
      '새 뱃지 획득!',
      `"${badgeName}" 뱃지를 획득했어요!`,
    );
  }

  /**
   * 특정 가격의 검증 목록 조회
   */
  async getVerificationsByPrice(
    priceId: string,
    result?: VerificationResult,
    page = 1,
    limit = 10,
  ): Promise<{
    data: VerificationDetailDto[];
    meta: {
      total: number;
      confirmedCount: number;
      disputedCount: number;
    };
  }> {
    const price = await this.priceRepository.findOne({
      where: { id: priceId },
    });

    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    let query = this.verificationRepository
      .createQueryBuilder('v')
      .leftJoin('v.price', 'price')
      .leftJoinAndSelect('v.verifier', 'verifier')
      .where('price.id = :priceId', { priceId })
      .orderBy('v.createdAt', 'DESC');

    if (result) {
      query = query.andWhere('v.result = :result', { result });
    }

    const [verifications, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const confirmedCount = price.confirmedCount || 0;
    const disputedCount = price.disputedCount || 0;

    const data = verifications.map((v) => ({
      id: v.id,
      result: v.result,
      actualPrice: v.actualPrice,
      verifier: {
        id: v.verifier.id,
        nickname: v.verifier.nickname,
        trustScore: v.verifier.trustScore,
        representativeBadge: null,
        profileImageUrl: null,
      },
      createdAt: v.createdAt,
    }));

    return {
      data,
      meta: {
        total,
        confirmedCount,
        disputedCount,
      },
    };
  }

  /**
   * 사용자가 검증한 가격 목록 조회
   */
  async getVerificationsByVerifier(
    verifierId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    data: Array<{
      id: string;
      priceId: string;
      result: VerificationResult;
      actualPrice: number | null;
      price: {
        id: string;
        price: number;
        product: { id: string; name: string };
        store: { id: string; name: string };
      };
      createdAt: Date;
    }>;
    meta: { total: number };
  }> {
    const [verifications, total] = await this.verificationRepository
      .createQueryBuilder('v')
      .leftJoin('v.verifier', 'verifier')
      .leftJoinAndSelect('v.price', 'price')
      .leftJoinAndSelect('price.product', 'product')
      .leftJoinAndSelect('price.store', 'store')
      .where('verifier.id = :verifierId', { verifierId })
      .orderBy('v.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: verifications
        .filter((v) => v.price && v.price.product && v.price.store)
        .map((v) => ({
          id: v.id,
          priceId: v.price.id,
          result: v.result,
          actualPrice: v.actualPrice,
          price: {
            id: v.price.id,
            price: v.price.price,
            product: {
              id: v.price.product.id,
              name: v.price.product.name,
            },
            store: {
              id: v.price.store.id,
              name: v.price.store.name,
            },
          },
          createdAt: v.createdAt,
        })),
      meta: { total },
    };
  }

  /**
   * 가격에 대한 검증 데이터로 신뢰도 계산 + 상세 정보 반환
   */
  async calculatePriceTrustScore(priceId: string) {
    const price = await this.priceRepository.findOne({
      where: { id: priceId },
    });

    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    const verifications = await this.verificationRepository.find({
      where: { price: { id: priceId } },
      relations: ['verifier'],
    });

    const verificationData = verifications.map((v) => ({
      result: v.result,
      verifierTrustScore: v.verifier.trustScore,
    }));

    const scoreResult =
      this.trustScoreCalculator.calculatePriceTrustScore(verificationData);

    const registeredAt = price.createdAt;
    const daysSinceRegistered = Math.floor(
      (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    // 30일 이상 경과 + 검증 10건 미만이면 stale
    const isStale =
      daysSinceRegistered >= 30 && (price.verificationCount ?? 0) < 10;

    return {
      ...scoreResult,
      verificationCount: price.verificationCount ?? 0,
      confirmedCount: price.confirmedCount ?? 0,
      disputedCount: price.disputedCount ?? 0,
      registeredAt,
      daysSinceRegistered,
      isStale,
    };
  }
}
