import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrustScoreService } from './trust-score.service';
import { User, UserRole } from '../user/entities/user.entity';
import { Price } from '../price/entities/price.entity';
import {
  PriceVerification,
  VerificationResult,
} from '../price-verification/entities/price-verification.entity';
import { UserTrustScore } from './entities/user-trust-score.entity';
import {
  UserTrustScoreCalculator,
  UserTrustScoreResult,
} from './services/user-trust-score.calculator';
import {
  PriceTrustScoreCalculator,
  PriceTrustScoreResult,
} from './services/price-trust-score.calculator';

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'find' | 'update'>>;
  let priceRepository: jest.Mocked<Pick<Repository<Price>, 'find' | 'update'>>;
  let verificationRepository: jest.Mocked<
    Pick<Repository<PriceVerification>, 'find'>
  >;
  let userTrustScoreRepository: jest.Mocked<
    Pick<
      Repository<UserTrustScore>,
      'find' | 'findOne' | 'update' | 'save' | 'create'
    >
  >;
  let userTrustScoreCalculator: jest.Mocked<UserTrustScoreCalculator>;
  let priceTrustScoreCalculator: jest.Mocked<PriceTrustScoreCalculator>;

  // ── fixture helpers ──────────────────────────────────────────────────────

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-uuid-1',
      email: 'test@example.com',
      nickname: '테스트유저',
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
      ...overrides,
    }) as User;

  const makePrice = (overrides: Partial<Price> = {}): Price =>
    ({
      id: 'price-uuid-1',
      price: 1000,
      trustScore: 75,
      verificationCount: 10,
      confirmedCount: 7,
      disputedCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Price;

  const makeVerification = (
    overrides: Partial<PriceVerification> = {},
  ): PriceVerification =>
    ({
      id: 'ver-uuid-1',
      result: VerificationResult.CONFIRMED,
      createdAt: new Date(),
      verifier: makeUser(),
      price: makePrice(),
      ...overrides,
    }) as PriceVerification;

  const makeUserTrustScore = (
    overrides: Partial<UserTrustScore> = {},
  ): UserTrustScore =>
    ({
      id: 'uts-uuid-1',
      trustScore: 50,
      registrationScore: 50,
      verificationScore: 50,
      consistencyBonus: 0,
      totalRegistrations: 0,
      totalVerifications: 0,
      createdAt: new Date(),
      calculatedAt: new Date(),
      ...overrides,
    }) as UserTrustScore;

  const defaultScoreResult: UserTrustScoreResult = {
    trustScore: 65,
    registrationScore: 70,
    verificationScore: 60,
    consistencyBonus: 10,
  };

  function makeQbMock(rawResult: { score: string }) {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(rawResult),
    };
    return qb;
  }

  // ── setup ─────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Price),
          useValue: { find: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(PriceVerification),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserTrustScore),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: UserTrustScoreCalculator,
          useValue: { calculateUserTrustScore: jest.fn() },
        },
        {
          provide: PriceTrustScoreCalculator,
          useValue: { calculatePriceTrustScore: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TrustScoreService);
    userRepository = module.get(getRepositoryToken(User));
    priceRepository = module.get(getRepositoryToken(Price));
    verificationRepository = module.get(getRepositoryToken(PriceVerification));
    userTrustScoreRepository = module.get(getRepositoryToken(UserTrustScore));
    userTrustScoreCalculator = module.get(UserTrustScoreCalculator);
    priceTrustScoreCalculator = module.get(PriceTrustScoreCalculator);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // recalculateUserTrustScoreFromReactions — 미구현 (CLAUDE.md 규칙10: 스케줄러만 단일 writer)
  // TrustScoreService에 해당 메서드가 존재하지 않으므로 테스트 제거
  // =========================================================================

  // =========================================================================
  // recalculateAll — 가격 → 사용자 순서 보장
  // =========================================================================

  describe('recalculateAll', () => {
    it('가격 신뢰도 → 사용자 신뢰도 순서로 실행', async () => {
      const callOrder: string[] = [];

      (priceRepository.find as jest.Mock).mockImplementation(async () => {
        callOrder.push('priceRepository.find');
        return [];
      });
      (userRepository.find as jest.Mock).mockImplementation(async () => {
        callOrder.push('userRepository.find');
        return [];
      });

      await service.recalculateAll();

      expect(callOrder[0]).toBe('priceRepository.find');
      expect(callOrder[1]).toBe('userRepository.find');
    });
  });

  // =========================================================================
  // recalculateAllPriceTrustScores
  // =========================================================================

  describe('recalculateAllPriceTrustScores', () => {
    it('검증 수 10건 이상인 가격이 없으면 priceRepository.update 미호출', async () => {
      (priceRepository.find as jest.Mock).mockResolvedValue([]);

      await service.recalculateAllPriceTrustScores();

      expect(priceRepository.update).not.toHaveBeenCalled();
    });

    it('가격 1건 존재 + 검증 데이터 있을 때 trustScore 업데이트', async () => {
      const price = makePrice({ id: 'price-1', verificationCount: 10 });
      const verifications = Array.from({ length: 10 }, (_, i) =>
        makeVerification({
          id: `ver-${i}`,
          price,
          verifier: makeUser({ id: `verifier-${i}`, trustScore: 60 }),
          result: VerificationResult.CONFIRMED,
        }),
      );

      (priceRepository.find as jest.Mock).mockResolvedValue([price]);
      (verificationRepository.find as jest.Mock).mockResolvedValue(
        verifications,
      );

      const scoredResult: PriceTrustScoreResult = {
        score: 88.5,
        status: 'scored',
      };
      (
        priceTrustScoreCalculator.calculatePriceTrustScore as jest.Mock
      ).mockReturnValue(scoredResult);

      await service.recalculateAllPriceTrustScores();

      expect(priceRepository.update).toHaveBeenCalledWith('price-1', {
        trustScore: 88.5,
      });
    });

    it('calculator가 status=verifying 반환하면 priceRepository.update 미호출', async () => {
      const price = makePrice({ id: 'price-1', verificationCount: 10 });

      (priceRepository.find as jest.Mock).mockResolvedValue([price]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);

      const verifyingResult: PriceTrustScoreResult = {
        score: null,
        status: 'verifying',
      };
      (
        priceTrustScoreCalculator.calculatePriceTrustScore as jest.Mock
      ).mockReturnValue(verifyingResult);

      await service.recalculateAllPriceTrustScores();

      expect(priceRepository.update).not.toHaveBeenCalled();
    });

    it('verifier.trustScore가 없으면 기본값 50 사용', async () => {
      const price = makePrice({ id: 'price-1', verificationCount: 10 });
      const verification = makeVerification({
        price,
        verifier: { trustScore: undefined } as any,
      });

      (priceRepository.find as jest.Mock).mockResolvedValue([price]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([
        verification,
      ]);

      const scoredResult: PriceTrustScoreResult = {
        score: 70,
        status: 'scored',
      };
      (
        priceTrustScoreCalculator.calculatePriceTrustScore as jest.Mock
      ).mockReturnValue(scoredResult);

      await service.recalculateAllPriceTrustScores();

      expect(
        priceTrustScoreCalculator.calculatePriceTrustScore,
      ).toHaveBeenCalledWith([
        { result: VerificationResult.CONFIRMED, verifierTrustScore: 50 },
      ]);
    });

    it('검증 데이터가 여러 price에 걸쳐 있을 때 priceId별로 그룹화하여 처리', async () => {
      const price1 = makePrice({ id: 'price-1', verificationCount: 15 });
      const price2 = makePrice({ id: 'price-2', verificationCount: 12 });

      const verifications = [
        ...Array.from({ length: 8 }, (_, i) =>
          makeVerification({
            id: `ver-p1-${i}`,
            price: price1,
            result: VerificationResult.CONFIRMED,
          }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          makeVerification({
            id: `ver-p2-${i}`,
            price: price2,
            result: VerificationResult.DISPUTED,
          }),
        ),
      ];

      (priceRepository.find as jest.Mock).mockResolvedValue([price1, price2]);
      (verificationRepository.find as jest.Mock).mockResolvedValue(
        verifications,
      );

      const scoredResult: PriceTrustScoreResult = {
        score: 75,
        status: 'scored',
      };
      (
        priceTrustScoreCalculator.calculatePriceTrustScore as jest.Mock
      ).mockReturnValue(scoredResult);

      await service.recalculateAllPriceTrustScores();

      expect(
        priceTrustScoreCalculator.calculatePriceTrustScore,
      ).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // recalculateAllUserTrustScores
  // =========================================================================

  describe('recalculateAllUserTrustScores', () => {
    it('사용자가 없으면 계산기 및 repository update 미호출', async () => {
      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([]);

      await service.recalculateAllUserTrustScores();

      expect(
        userTrustScoreCalculator.calculateUserTrustScore,
      ).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('사용자 1명 존재, 기존 UserTrustScore 레코드 있음 → update 호출', async () => {
      const user = makeUser();

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      const existingScore = makeUserTrustScore({
        id: 'uts-1',
        user: user as any,
      });
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([
        existingScore,
      ]);

      await service.recalculateAllUserTrustScores();

      expect(userTrustScoreRepository.update).toHaveBeenCalledWith('uts-1', {
        trustScore: defaultScoreResult.trustScore,
        registrationScore: defaultScoreResult.registrationScore,
        verificationScore: defaultScoreResult.verificationScore,
        consistencyBonus: defaultScoreResult.consistencyBonus,
        totalRegistrations: 0,
        totalVerifications: 0,
      });

      expect(userRepository.update).toHaveBeenCalledWith(user.id, {
        trustScore: defaultScoreResult.trustScore,
      });
    });

    it('사용자 1명 존재, 기존 UserTrustScore 레코드 없음 → save 호출', async () => {
      const user = makeUser();
      const newScore = makeUserTrustScore();

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(newScore);
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(newScore);

      await service.recalculateAllUserTrustScores();

      expect(userTrustScoreRepository.create).toHaveBeenCalled();
      expect(userTrustScoreRepository.save).toHaveBeenCalled();
    });

    it('가격 0건, 검증 0건 → registrationScore=50, verificationScore=50 (기본값)', async () => {
      const user = makeUser();

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(
        makeUserTrustScore(),
      );
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(
        makeUserTrustScore(),
      );
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      await service.recalculateAllUserTrustScores();

      const callArg =
        userTrustScoreCalculator.calculateUserTrustScore.mock.calls[0][0];
      expect(callArg.registrationScore).toBe(50);
      expect(callArg.verificationScore).toBe(50);
      expect(callArg.totalRegistrations).toBe(0);
      expect(callArg.totalVerifications).toBe(0);
    });

    it('검증이 다수 의견과 일치하면 alignedCount 증가', async () => {
      const user = makeUser({ id: 'user-1' });
      const price = makePrice({ confirmedCount: 7, disputedCount: 3 });

      const verifications = [
        makeVerification({
          verifier: user,
          price,
          result: VerificationResult.CONFIRMED, // 다수 의견과 일치
          createdAt: new Date(),
        }),
        makeVerification({
          id: 'ver-2',
          verifier: user,
          price,
          result: VerificationResult.DISPUTED, // 다수 의견과 불일치
          createdAt: new Date(),
        }),
      ];

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue(
        verifications,
      );
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(
        makeUserTrustScore(),
      );
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(
        makeUserTrustScore(),
      );
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      await service.recalculateAllUserTrustScores();

      const callArg =
        userTrustScoreCalculator.calculateUserTrustScore.mock.calls[0][0];
      // 2건 중 1건 일치 → verificationScore = (1/2)*100 = 50
      expect(callArg.verificationScore).toBe(50);
    });

    it('최근 30일 이전 가격은 activeDays 계산에서 제외', async () => {
      const user = makeUser({ id: 'user-1' });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      const prices = [makePrice({ createdAt: oldDate, user: user as any })];

      (priceRepository.find as jest.Mock).mockResolvedValue(prices);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(
        makeUserTrustScore(),
      );
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(
        makeUserTrustScore(),
      );
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      await service.recalculateAllUserTrustScores();

      const callArg =
        userTrustScoreCalculator.calculateUserTrustScore.mock.calls[0][0];
      expect(callArg.activeDays).toBe(0);
    });

    it('user.trustScore를 결과값으로 저장', async () => {
      const user = makeUser();

      const fractionalResult: UserTrustScoreResult = {
        trustScore: 65,
        registrationScore: 70,
        verificationScore: 60,
        consistencyBonus: 10,
      };

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([
        makeUserTrustScore({ id: 'uts-1', user: makeUser() as any }),
      ]);
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(fractionalResult);

      await service.recalculateAllUserTrustScores();

      expect(userRepository.update).toHaveBeenCalledWith(user.id, {
        trustScore: 65,
      });
    });

    it('사용자 여러 명 → 각 사용자마다 독립적으로 계산', async () => {
      const users = [
        makeUser({ id: 'user-1' }),
        makeUser({ id: 'user-2' }),
        makeUser({ id: 'user-3' }),
      ];

      (priceRepository.find as jest.Mock).mockResolvedValue([]);
      (userRepository.find as jest.Mock).mockResolvedValue(users);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(
        makeUserTrustScore(),
      );
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(
        makeUserTrustScore(),
      );
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      await service.recalculateAllUserTrustScores();

      expect(
        userTrustScoreCalculator.calculateUserTrustScore,
      ).toHaveBeenCalledTimes(3);
      expect(userRepository.update).toHaveBeenCalledTimes(3);
    });

    it('최근 90일 가격 중 trustScore 있는 것의 평균을 registrationScore로 사용', async () => {
      const user = makeUser({ id: 'user-1' });
      const prices = [
        makePrice({ trustScore: 80, createdAt: new Date(), user: user as any }),
        makePrice({
          id: 'price-2',
          trustScore: 60,
          createdAt: new Date(),
          user: user as any,
        }),
        makePrice({
          id: 'price-3',
          trustScore: null,
          createdAt: new Date(),
          user: user as any,
        }),
      ];

      (priceRepository.find as jest.Mock).mockResolvedValue(prices);
      (userRepository.find as jest.Mock).mockResolvedValue([user]);
      (verificationRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.find as jest.Mock).mockResolvedValue([]);
      (userTrustScoreRepository.create as jest.Mock).mockReturnValue(
        makeUserTrustScore(),
      );
      (userTrustScoreRepository.save as jest.Mock).mockResolvedValue(
        makeUserTrustScore(),
      );
      (
        userTrustScoreCalculator.calculateUserTrustScore as jest.Mock
      ).mockReturnValue(defaultScoreResult);

      await service.recalculateAllUserTrustScores();

      const callArg =
        userTrustScoreCalculator.calculateUserTrustScore.mock.calls[0][0];
      // (80 + 60) / 2 = 70
      expect(callArg.registrationScore).toBe(70);
    });
  });
});
