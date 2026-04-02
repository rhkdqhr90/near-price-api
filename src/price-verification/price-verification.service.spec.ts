import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository, DataSource, SelectQueryBuilder, MoreThan } from 'typeorm';
import { PriceVerificationService } from './price-verification.service';
import {
  PriceVerification,
  VerificationResult,
} from './entities/price-verification.entity';
import { Price } from '../price/entities/price.entity';
import { User, UserRole } from '../user/entities/user.entity';
import { PriceTrustScoreCalculator } from '../trust-score/services/price-trust-score.calculator';
import { NotificationService } from '../notification/notification.service';

// QueryBuilder 체인 mock 헬퍼
function makeQbMock(manyAndCount: [PriceVerification[], number]) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(manyAndCount),
  } as unknown as SelectQueryBuilder<PriceVerification>;
  return qb;
}

// QueryRunner mock 헬퍼
function makeQueryRunnerMock(
  existingVerification: PriceVerification | null = null,
) {
  const innerQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn().mockResolvedValue(existingVerification),
      createQueryBuilder: jest.fn().mockReturnValue(innerQb),
    },
  };
}

describe('PriceVerificationService', () => {
  let service: PriceVerificationService;
  let verificationRepository: jest.Mocked<Repository<PriceVerification>>;
  let priceRepository: jest.Mocked<Repository<Price>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;
  let notificationService: jest.Mocked<NotificationService>;
  let trustScoreCalculator: jest.Mocked<PriceTrustScoreCalculator>;

  // ── fixtures ─────────────────────────────────────────────────────────────

  const PRICE_OWNER_ID = 'owner-uuid-1';
  const VERIFIER_ID = 'verifier-uuid-1';
  const PRICE_ID = 'price-uuid-1';

  const mockOwner: User = {
    id: PRICE_OWNER_ID,
    email: 'owner@example.com',
    nickname: '등록자',
    profileImageUrl: null,
    fcmToken: null,
    notifPriceChange: true,
    notifPromotion: false,
    nicknameChangedAt: null,
    latitude: null,
    longitude: null,
    role: UserRole.USER,
    trustScore: 50,
    oauths: [],
    prices: [],
    wishlists: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockVerifier: User = {
    ...mockOwner,
    id: VERIFIER_ID,
    email: 'verifier@example.com',
    nickname: '검증자',
  };

  const mockPrice: Price = {
    id: PRICE_ID,
    user: mockOwner,
    store: { id: 'store-1', name: '테스트마트' } as any,
    product: { id: 'product-1', name: '우유' } as any,
    price: 2000,
    quantity: null,
    imageUrl: '',
    saleStartDate: null,
    saleEndDate: null,
    condition: null,
    isActive: true,
    likeCount: 0,
    reportCount: 0,
    trustScore: null,
    verificationCount: 0,
    confirmedCount: 0,
    disputedCount: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  // ── beforeEach ────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceVerificationService,
        {
          provide: getRepositoryToken(PriceVerification),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Price),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: PriceTrustScoreCalculator,
          useValue: {
            calculatePriceTrustScore: jest.fn().mockReturnValue({
              score: 80,
              status: 'scored',
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUser: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PriceVerificationService);
    verificationRepository = module.get(getRepositoryToken(PriceVerification));
    priceRepository = module.get(getRepositoryToken(Price));
    userRepository = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
    notificationService = module.get(NotificationService);
    trustScoreCalculator = module.get(PriceTrustScoreCalculator);
  });

  // ── createVerification ───────────────────────────────────────────────────

  describe('createVerification', () => {
    it('가격 데이터 없음 → NotFoundException', async () => {
      priceRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('본인이 등록한 가격 → ForbiddenException', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      await expect(
        service.createVerification(PRICE_ID, PRICE_OWNER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('24시간 이내 중복 검증 → ForbiddenException', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      // queryRunner.manager.findOne이 기존 검증 반환 (트랜잭션 내 중복 체크)
      const existingVerification = {
        id: 'existing-v',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      } as PriceVerification;
      const qr = makeQueryRunnerMock(existingVerification);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('24시간 이내 중복 검증 확인 시 MoreThan(since24h) 조건으로 쿼리', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      // qr.manager.findOne이 null 반환 → 중복 없음으로 처리 후 새 검증 생성
      const qr = makeQueryRunnerMock(null);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'new-v-uuid',
        price: mockPrice,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      qr.manager.create.mockReturnValue(savedVerification);
      qr.manager.save.mockResolvedValue(savedVerification);

      const beforeCall = Date.now();
      await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.CONFIRMED,
      });
      const afterCall = Date.now();

      // queryRunner.manager.findOne이 호출되었고 where 조건에 MoreThan이 포함되는지 확인
      expect(qr.manager.findOne).toHaveBeenCalledWith(
        PriceVerification,
        expect.objectContaining({
          where: expect.objectContaining({
            price: { id: PRICE_ID },
            verifier: { id: VERIFIER_ID },
            createdAt: expect.anything(), // MoreThan(since24h)
          }),
        }),
      );

      // 전달된 createdAt 값이 24시간 이전 범위인지 검증
      const callArgs = qr.manager.findOne.mock.calls[0][1] as {
        where: { createdAt: ReturnType<typeof MoreThan> };
      };
      const since24hValue = callArgs.where.createdAt.value as Date;
      const expectedSince24h = new Date(beforeCall - 24 * 60 * 60 * 1000);
      const expectedSince24hAfter = new Date(afterCall - 24 * 60 * 60 * 1000);
      // since24h가 24시간 전과 가까운지 확인 (±5초 오차 허용)
      expect(since24hValue.getTime()).toBeGreaterThanOrEqual(
        expectedSince24h.getTime() - 5000,
      );
      expect(since24hValue.getTime()).toBeLessThanOrEqual(
        expectedSince24hAfter.getTime() + 5000,
      );
    });

    it('25시간 전 검증은 중복으로 처리하지 않음 (24시간 외)', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      // qr.manager.findOne이 null을 반환하면 중복 없음으로 처리
      const qr = makeQueryRunnerMock(null);
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'new-v-uuid',
        price: mockPrice,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      qr.manager.create.mockReturnValue(savedVerification);
      qr.manager.save.mockResolvedValue(savedVerification);

      // 중복 없음(null) → 정상 진행
      const result = await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.CONFIRMED,
      });
      expect(result.id).toBe('new-v-uuid');
    });

    it('검증자 없음 → NotFoundException', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('달라요 검증 시 actualPrice 없으면 → BadRequestException', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.DISPUTED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('맞아요 검증 성공 → VerificationResponseDto 반환', async () => {
      priceRepository.findOne.mockResolvedValue({ ...mockPrice });
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'new-v-uuid',
        price: mockPrice,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      qr.manager.create.mockReturnValue(savedVerification);
      qr.manager.save.mockResolvedValue(savedVerification);

      const result = await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.CONFIRMED,
      });

      expect(result.id).toBe('new-v-uuid');
      expect(result.result).toBe(VerificationResult.CONFIRMED);
      expect(result.newPriceId).toBeNull();
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('맞아요 검증 성공 → confirmedCount atomic 증가 (QueryBuilder execute 호출)', async () => {
      const priceWithCounts = {
        ...mockPrice,
        confirmedCount: 2,
        verificationCount: 2,
      };
      priceRepository.findOne.mockResolvedValue(priceWithCounts);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'new-v-uuid',
        price: priceWithCounts,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      qr.manager.create.mockReturnValue(savedVerification);
      qr.manager.save.mockResolvedValue(savedVerification);

      await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.CONFIRMED,
      });

      // 서비스는 atomic increment (QueryBuilder.execute)를 사용하므로 qb.execute 호출을 검증
      const innerQb = qr.manager.createQueryBuilder();
      expect(qr.manager.createQueryBuilder).toHaveBeenCalled();
      expect(innerQb.execute).toHaveBeenCalled();
    });

    it('달라요 검증 성공 → disputedCount atomic 증가 (QueryBuilder execute 호출)', async () => {
      const priceWithCounts = {
        ...mockPrice,
        disputedCount: 1,
        verificationCount: 1,
      };
      priceRepository.findOne.mockResolvedValue(priceWithCounts);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'disputed-count-uuid',
        price: priceWithCounts,
        verifier: mockVerifier,
        result: VerificationResult.DISPUTED,
        actualPrice: 1500,
        newPrice: null,
        createdAt: new Date(),
      };
      const savedNewPrice: Price = {
        ...mockPrice,
        id: 'new-price-uuid',
        price: 1500,
      };

      qr.manager.create
        .mockReturnValueOnce(savedVerification)
        .mockReturnValueOnce(savedNewPrice);
      qr.manager.save
        .mockResolvedValueOnce(savedVerification)
        .mockResolvedValueOnce(savedNewPrice)
        .mockResolvedValue(savedVerification);

      await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.DISPUTED,
        actualPrice: 1500,
      });

      // 서비스는 atomic increment (QueryBuilder.execute)를 사용하므로 qb.execute 호출을 검증
      const innerQb = qr.manager.createQueryBuilder();
      expect(qr.manager.createQueryBuilder).toHaveBeenCalled();
      expect(innerQb.execute).toHaveBeenCalled();
    });

    it('달라요 검증 성공 → 새 가격 데이터 생성', async () => {
      priceRepository.findOne.mockResolvedValue({ ...mockPrice });
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'disputed-v-uuid',
        price: mockPrice,
        verifier: mockVerifier,
        result: VerificationResult.DISPUTED,
        actualPrice: 1800,
        newPrice: null,
        createdAt: new Date(),
      };
      const savedNewPrice: Price = {
        ...mockPrice,
        id: 'new-price-uuid',
        price: 1800,
      };

      qr.manager.create
        .mockReturnValueOnce(savedVerification)
        .mockReturnValueOnce(savedNewPrice);
      qr.manager.save
        .mockResolvedValueOnce(savedVerification)
        .mockResolvedValueOnce(savedNewPrice)
        .mockResolvedValue(savedVerification);

      const result = await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.DISPUTED,
        actualPrice: 1800,
      });

      expect(result.result).toBe(VerificationResult.DISPUTED);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('트랜잭션 오류 시 rollback 실행', async () => {
      priceRepository.findOne.mockResolvedValue({ ...mockPrice });
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);
      qr.manager.create.mockReturnValue({} as PriceVerification);
      qr.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow('DB error');

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('트랜잭션 오류 시에도 release는 반드시 호출', async () => {
      priceRepository.findOne.mockResolvedValue({ ...mockPrice });
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);
      qr.manager.create.mockReturnValue({} as PriceVerification);
      qr.manager.save.mockRejectedValue(new Error('unexpected error'));

      await expect(
        service.createVerification(PRICE_ID, VERIFIER_ID, {
          result: VerificationResult.CONFIRMED,
        }),
      ).rejects.toThrow();

      // finally 블록에서 release가 호출되어야 함
      expect(qr.release).toHaveBeenCalledTimes(1);
    });

    it('가격 등록자에게 FCM 알림 전송 시도 (fire-and-forget)', async () => {
      const ownerWithToken: User = {
        ...mockOwner,
        fcmToken: 'owner-fcm-token',
      };
      const priceWithOwner: Price = { ...mockPrice, user: ownerWithToken };
      priceRepository.findOne.mockResolvedValue(priceWithOwner);
      verificationRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(mockVerifier);

      const qr = makeQueryRunnerMock();
      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(qr);

      const savedVerification: PriceVerification = {
        id: 'notify-v-uuid',
        price: priceWithOwner,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      qr.manager.create.mockReturnValue(savedVerification);
      qr.manager.save.mockResolvedValue(savedVerification);

      await service.createVerification(PRICE_ID, VERIFIER_ID, {
        result: VerificationResult.CONFIRMED,
      });

      // fire-and-forget이라 즉시 확인하면 호출 전일 수 있으므로 짧게 대기
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'owner-fcm-token',
        '가격 검증 도착',
        expect.stringContaining('맞아요'),
      );
    });
  });

  // ── getVerificationsByPrice ──────────────────────────────────────────────

  describe('getVerificationsByPrice', () => {
    it('가격 데이터 없음 → NotFoundException', async () => {
      priceRepository.findOne.mockResolvedValue(null);
      await expect(service.getVerificationsByPrice(PRICE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('검증 목록 반환', async () => {
      const priceWithCounts: Price = {
        ...mockPrice,
        confirmedCount: 3,
        disputedCount: 1,
      };
      priceRepository.findOne.mockResolvedValue(priceWithCounts);

      const mockVerificationItem: PriceVerification = {
        id: 'v-1',
        price: mockPrice,
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const qb = makeQbMock([[mockVerificationItem], 1]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByPrice(PRICE_ID);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.confirmedCount).toBe(3);
      expect(result.meta.disputedCount).toBe(1);
    });

    it('result 필터 파라미터 전달 시 andWhere 호출', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);

      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByPrice(
        PRICE_ID,
        VerificationResult.CONFIRMED,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('v.result = :result', {
        result: VerificationResult.CONFIRMED,
      });
    });

    it('result 필터 없을 때 andWhere 미호출', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);

      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByPrice(PRICE_ID);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('페이징 파라미터 반영 → skip/take 호출', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);

      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByPrice(PRICE_ID, undefined, 3, 20);

      // page=3, limit=20 → skip=40, take=20
      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('confirmedCount/disputedCount null일 때 0으로 처리', async () => {
      const priceNoCounts: Price = {
        ...mockPrice,
        confirmedCount: null as any,
        disputedCount: null as any,
      };
      priceRepository.findOne.mockResolvedValue(priceNoCounts);

      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByPrice(PRICE_ID);

      expect(result.meta.confirmedCount).toBe(0);
      expect(result.meta.disputedCount).toBe(0);
    });
  });

  // ── getVerificationsByVerifier ───────────────────────────────────────────

  describe('getVerificationsByVerifier', () => {
    it('정상적인 검증 목록 반환', async () => {
      const verificationItem: PriceVerification = {
        id: 'v-1',
        price: {
          ...mockPrice,
          product: { id: 'product-1', name: '우유' } as any,
          store: { id: 'store-1', name: '테스트마트' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const qb = makeQbMock([[verificationItem], 1]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].id).toBe('v-1');
      expect(result.data[0].price.product.name).toBe('우유');
      expect(result.data[0].price.store.name).toBe('테스트마트');
    });

    it('price가 null인 레코드는 filter로 제거', async () => {
      const validItem: PriceVerification = {
        id: 'v-valid',
        price: {
          ...mockPrice,
          product: { id: 'p-1', name: '사과' } as any,
          store: { id: 's-1', name: '마트A' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const nullPriceItem: PriceVerification = {
        id: 'v-null-price',
        price: null as any, // price가 null
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const qb = makeQbMock([[validItem, nullPriceItem], 2]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      // null price 레코드는 제거되어야 함
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('v-valid');
      // total은 DB 원본 카운트
      expect(result.meta.total).toBe(2);
    });

    it('price.product가 null인 레코드는 filter로 제거', async () => {
      const validItem: PriceVerification = {
        id: 'v-valid',
        price: {
          ...mockPrice,
          product: { id: 'p-1', name: '사과' } as any,
          store: { id: 's-1', name: '마트A' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const nullProductItem: PriceVerification = {
        id: 'v-null-product',
        price: {
          ...mockPrice,
          product: null as any, // product가 null
          store: { id: 's-1', name: '마트A' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const qb = makeQbMock([[validItem, nullProductItem], 2]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('v-valid');
    });

    it('price.store가 null인 레코드는 filter로 제거', async () => {
      const validItem: PriceVerification = {
        id: 'v-valid',
        price: {
          ...mockPrice,
          product: { id: 'p-1', name: '사과' } as any,
          store: { id: 's-1', name: '마트A' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const nullStoreItem: PriceVerification = {
        id: 'v-null-store',
        price: {
          ...mockPrice,
          product: { id: 'p-1', name: '사과' } as any,
          store: null as any, // store가 null
        },
        verifier: mockVerifier,
        result: VerificationResult.CONFIRMED,
        actualPrice: null,
        newPrice: null,
        createdAt: new Date(),
      };
      const qb = makeQbMock([[validItem, nullStoreItem], 2]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('v-valid');
    });

    it('price/product/store 모두 null인 레코드들은 전부 제거', async () => {
      const allNullItems: PriceVerification[] = [
        {
          id: 'v-1',
          price: null as any,
          verifier: mockVerifier,
          result: VerificationResult.CONFIRMED,
          actualPrice: null,
          newPrice: null,
          createdAt: new Date(),
        },
        {
          id: 'v-2',
          price: { ...mockPrice, product: null as any, store: null as any },
          verifier: mockVerifier,
          result: VerificationResult.DISPUTED,
          actualPrice: 1000,
          newPrice: null,
          createdAt: new Date(),
        },
        {
          id: 'v-3',
          price: {
            ...mockPrice,
            product: { id: 'p-1', name: '과자' } as any,
            store: null as any,
          },
          verifier: mockVerifier,
          result: VerificationResult.CONFIRMED,
          actualPrice: null,
          newPrice: null,
          createdAt: new Date(),
        },
      ];
      const qb = makeQbMock([allNullItems, 3]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(3);
    });

    it('빈 목록 반환 시 data는 빈 배열, total은 0', async () => {
      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('페이징 파라미터 반영 → skip/take 호출', async () => {
      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByVerifier(VERIFIER_ID, 2, 5);

      // page=2, limit=5 → skip=5, take=5
      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('verifierId로 where 조건 설정', async () => {
      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(qb.where).toHaveBeenCalledWith('verifier.id = :verifierId', {
        verifierId: VERIFIER_ID,
      });
    });

    it('price, product, store leftJoin 포함', async () => {
      const qb = makeQbMock([[], 0]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('v.price', 'price');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'price.product',
        'product',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('price.store', 'store');
    });

    it('반환 데이터 구조 확인', async () => {
      const verificationItem: PriceVerification = {
        id: 'v-struct',
        price: {
          ...mockPrice,
          product: { id: 'p-struct', name: '두부' } as any,
          store: { id: 's-struct', name: '시장B' } as any,
        },
        verifier: mockVerifier,
        result: VerificationResult.DISPUTED,
        actualPrice: 1200,
        newPrice: null,
        createdAt: new Date('2026-03-01'),
      };
      const qb = makeQbMock([[verificationItem], 1]);
      verificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getVerificationsByVerifier(VERIFIER_ID);

      expect(result.data[0]).toMatchObject({
        id: 'v-struct',
        priceId: PRICE_ID,
        result: VerificationResult.DISPUTED,
        actualPrice: 1200,
        price: {
          id: PRICE_ID,
          price: 2000,
          product: { id: 'p-struct', name: '두부' },
          store: { id: 's-struct', name: '시장B' },
        },
      });
    });
  });

  // ── calculatePriceTrustScore ─────────────────────────────────────────────

  describe('calculatePriceTrustScore', () => {
    it('검증 목록으로 신뢰도 계산 위임', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      verificationRepository.find.mockResolvedValue([
        {
          id: 'v-1',
          result: VerificationResult.CONFIRMED,
          verifier: { ...mockVerifier, trustScore: 80 },
        } as PriceVerification,
      ]);

      const result = await service.calculatePriceTrustScore(PRICE_ID);
      expect(result).toBeDefined();
      expect(result.verificationCount).toBeDefined();
      expect(result.confirmedCount).toBeDefined();
      expect(result.isStale).toBeDefined();
    });

    it('가격 데이터 없음 → NotFoundException', async () => {
      priceRepository.findOne.mockResolvedValue(null);
      await expect(
        service.calculatePriceTrustScore('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('trustScoreCalculator.calculatePriceTrustScore 호출', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      verificationRepository.find.mockResolvedValue([]);

      await service.calculatePriceTrustScore(PRICE_ID);

      expect(
        trustScoreCalculator.calculatePriceTrustScore,
      ).toHaveBeenCalledWith([]);
    });

    it('검증이 없는 경우 verificationCount/confirmedCount/disputedCount 0', async () => {
      const priceNoVerifications: Price = {
        ...mockPrice,
        verificationCount: 0,
        confirmedCount: 0,
        disputedCount: 0,
      };
      priceRepository.findOne.mockResolvedValue(priceNoVerifications);
      verificationRepository.find.mockResolvedValue([]);

      const result = await service.calculatePriceTrustScore(PRICE_ID);

      expect(result.verificationCount).toBe(0);
      expect(result.confirmedCount).toBe(0);
      expect(result.disputedCount).toBe(0);
    });

    it('30일 이상 경과 + 검증 10건 미만 → isStale true', async () => {
      const oldPrice: Price = {
        ...mockPrice,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31일 전
        verificationCount: 5,
      };
      priceRepository.findOne.mockResolvedValue(oldPrice);
      verificationRepository.find.mockResolvedValue([]);

      const result = await service.calculatePriceTrustScore(PRICE_ID);

      expect(result.isStale).toBe(true);
    });

    it('30일 미만 경과 → isStale false', async () => {
      const recentPrice: Price = {
        ...mockPrice,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10일 전
        verificationCount: 2,
      };
      priceRepository.findOne.mockResolvedValue(recentPrice);
      verificationRepository.find.mockResolvedValue([]);

      const result = await service.calculatePriceTrustScore(PRICE_ID);

      expect(result.isStale).toBe(false);
    });

    it('30일 이상 경과했지만 검증 10건 이상 → isStale false', async () => {
      const oldPriceWellVerified: Price = {
        ...mockPrice,
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40일 전
        verificationCount: 15,
      };
      priceRepository.findOne.mockResolvedValue(oldPriceWellVerified);
      verificationRepository.find.mockResolvedValue([]);

      const result = await service.calculatePriceTrustScore(PRICE_ID);

      expect(result.isStale).toBe(false);
    });

    it('verificationData를 올바른 형식으로 trustScoreCalculator에 전달', async () => {
      priceRepository.findOne.mockResolvedValue(mockPrice);
      const verifications: PriceVerification[] = [
        {
          id: 'v-a',
          result: VerificationResult.CONFIRMED,
          verifier: { ...mockVerifier, trustScore: 70 },
          price: mockPrice,
          actualPrice: null,
          newPrice: null,
          createdAt: new Date(),
        },
        {
          id: 'v-b',
          result: VerificationResult.DISPUTED,
          verifier: { ...mockVerifier, trustScore: 30 },
          price: mockPrice,
          actualPrice: 1500,
          newPrice: null,
          createdAt: new Date(),
        },
      ];
      verificationRepository.find.mockResolvedValue(verifications);

      await service.calculatePriceTrustScore(PRICE_ID);

      expect(
        trustScoreCalculator.calculatePriceTrustScore,
      ).toHaveBeenCalledWith([
        { result: VerificationResult.CONFIRMED, verifierTrustScore: 70 },
        { result: VerificationResult.DISPUTED, verifierTrustScore: 30 },
      ]);
    });
  });
});
