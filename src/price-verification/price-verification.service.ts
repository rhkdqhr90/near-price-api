import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
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

@Injectable()
export class PriceVerificationService {
  constructor(
    @InjectRepository(PriceVerification)
    private verificationRepository: Repository<PriceVerification>,
    @InjectRepository(Price)
    private priceRepository: Repository<Price>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private trustScoreCalculator: PriceTrustScoreCalculator,
    private dataSource: DataSource,
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
      relations: ['user'],
    });

    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    // 본인이 등록한 가격은 검증할 수 없음
    if (price.user?.id === userId) {
      throw new ForbiddenException('본인이 등록한 가격은 검증할 수 없습니다');
    }

    // 24시간 내 중복 검증 확인
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingVerification = await this.verificationRepository.findOne({
      where: {
        price: { id: priceId },
        verifier: { id: userId },
        createdAt: LessThan(new Date()),
      },
    });

    if (existingVerification) {
      const timeDiff = Date.now() - existingVerification.createdAt.getTime();
      if (timeDiff < 24 * 60 * 60 * 1000) {
        throw new ForbiddenException('24시간 이내에 이미 검증했습니다');
      }
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

      // 가격 데이터의 검증 카운트 업데이트
      price.verificationCount = (price.verificationCount || 0) + 1;
      if (createVerificationDto.result === VerificationResult.CONFIRMED) {
        price.confirmedCount = (price.confirmedCount || 0) + 1;
      } else {
        price.disputedCount = (price.disputedCount || 0) + 1;
      }
      await queryRunner.manager.save(price);

      await queryRunner.commitTransaction();

      return {
        id: savedVerification.id,
        priceId: savedVerification.price.id,
        result: savedVerification.result,
        actualPrice: savedVerification.actualPrice,
        newPriceId: newPrice?.id || null,
        createdAt: savedVerification.createdAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      .where('v.price_id = :priceId', { priceId })
      .leftJoinAndSelect('v.verifier', 'verifier')
      .orderBy('v.created_at', 'DESC');

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
  async getVerificationsByVerifier(verifierId: string, page = 1, limit = 10) {
    const [verifications, total] = await this.verificationRepository
      .createQueryBuilder('v')
      .where('v.verifier_id = :verifierId', { verifierId })
      .leftJoinAndSelect('v.price', 'price')
      .leftJoinAndSelect('price.product', 'product')
      .leftJoinAndSelect('price.store', 'store')
      .orderBy('v.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: verifications.map((v) => ({
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
   * 가격에 대한 검증 데이터로 신뢰도 계산
   */
  async calculatePriceTrustScore(priceId: string) {
    const verifications = await this.verificationRepository.find({
      where: { price: { id: priceId } },
      relations: ['verifier'],
    });

    const verificationData = verifications.map((v) => ({
      result: v.result,
      verifierTrustScore: v.verifier.trustScore,
    }));

    return await this.trustScoreCalculator.calculatePriceTrustScore(
      verificationData,
    );
  }

  /**
   * 사용자 신뢰도 점수 재계산
   */
  async recalculateTrustScore(userId: string) {
    // Implementation for recalculating trust score
    return await Promise.resolve();
  }
}
