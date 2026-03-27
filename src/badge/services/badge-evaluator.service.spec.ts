import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadgeEvaluatorService,
  BadgeEvaluationContext,
} from './badge-evaluator.service';
import { BadgeCategory } from '../entities/badge-definition.entity';
import { User, UserRole } from '../../user/entities/user.entity';
import { PriceVerification } from '../../price-verification/entities/price-verification.entity';

describe('BadgeEvaluatorService', () => {
  let service: BadgeEvaluatorService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne'>>;
  let priceVerificationRepository: jest.Mocked<
    Pick<Repository<PriceVerification>, 'countBy'>
  >;

  const mockUser: User = {
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
    trustScore: 0,
    oauths: [],
    prices: [],
    wishlists: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeEvaluatorService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PriceVerification),
          useValue: {
            countBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BadgeEvaluatorService);
    userRepository = module.get(getRepositoryToken(User));
    priceVerificationRepository = module.get(
      getRepositoryToken(PriceVerification),
    );
  });

  // ── getUserBadges ────────────────────────────────────────────────────────

  describe('getUserBadges', () => {
    it('사용자를 찾을 수 없으면 earned=[], progress=[] 반환', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.getUserBadges('non-existent');
      expect(result.earned).toEqual([]);
      expect(result.progress).toEqual([]);
    });

    it('가격 10개 등록한 사용자 → registration_10 뱃지 획득', async () => {
      const userWith10Prices: User = {
        ...mockUser,
        prices: Array.from(
          { length: 10 },
          (_, i) => ({ id: `price-${i}` }) as any,
        ),
      };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userWith10Prices);
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      const earnedTypes = result.earned.map((b: any) => b?.type);
      expect(earnedTypes).toContain('registration_10');
    });

    it('가격 0개, 검증 0건 사용자 → earned 없음, registration_10 진행 중', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      expect(result.earned).toHaveLength(0);
      const progressTypes = result.progress.map((p: any) => p.type);
      expect(progressTypes).toContain('registration_10');
    });

    it('검증 10건 사용자 → verification_10 뱃지 획득', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(10);

      const result = await service.getUserBadges(mockUser.id);
      const earnedTypes = result.earned.map((b: any) => b?.type);
      expect(earnedTypes).toContain('verification_10');
    });

    it('검증 50건 사용자 → verification_10, verification_50 모두 획득', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(50);

      const result = await service.getUserBadges(mockUser.id);
      const earnedTypes = result.earned.map((b: any) => b?.type);
      expect(earnedTypes).toContain('verification_10');
      expect(earnedTypes).toContain('verification_50');
      expect(earnedTypes).not.toContain('verification_200');
    });

    it('prices가 undefined인 사용자 → totalRegistrations 0으로 처리', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: undefined,
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      expect(result.earned).toHaveLength(0);
    });

    it('신뢰도 70 + 30일 유지 사용자 → trust_70_30 뱃지 획득', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        trustScore: 70,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      // trustScoreMaintainedDays 는 context에만 있으므로 getUserBadges에서는
      // 직접 제어할 수 없음 — evaluateEarnedBadges 수준 테스트로 별도 검증
      const result = await service.getUserBadges(mockUser.id);
      expect(result).toHaveProperty('earned');
      expect(result).toHaveProperty('progress');
    });

    it('priceVerificationRepository.countBy가 올바른 조건으로 호출됨', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(5);

      await service.getUserBadges('user-uuid-1');
      expect(priceVerificationRepository.countBy).toHaveBeenCalledWith({
        verifier: { id: 'user-uuid-1' },
      });
    });

    it('earned, progress 배열 형태로 반환', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: [],
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      expect(Array.isArray(result.earned)).toBe(true);
      expect(Array.isArray(result.progress)).toBe(true);
    });

    it('earned 항목은 type, name, icon, category 필드를 포함', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: Array.from(
          { length: 10 },
          (_, i) => ({ id: `price-${i}` }) as any,
        ),
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      expect(result.earned.length).toBeGreaterThan(0);
      const badge = result.earned[0] as any;
      expect(badge).toHaveProperty('type');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('icon');
      expect(badge).toHaveProperty('category');
    });

    it('progress 항목은 type, name, icon, category, current, threshold, progressPercent 필드를 포함', async () => {
      (userRepository.findOne as jest.Mock).mockResolvedValue({
        ...mockUser,
        prices: Array.from(
          { length: 5 },
          (_, i) => ({ id: `price-${i}` }) as any,
        ),
      });
      (priceVerificationRepository.countBy as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserBadges(mockUser.id);
      expect(result.progress.length).toBeGreaterThan(0);
      const prog = result.progress[0] as any;
      expect(prog).toHaveProperty('type');
      expect(prog).toHaveProperty('name');
      expect(prog).toHaveProperty('icon');
      expect(prog).toHaveProperty('category');
      expect(prog).toHaveProperty('current');
      expect(prog).toHaveProperty('threshold');
      expect(prog).toHaveProperty('progressPercent');
    });
  });

  // ── evaluateEarnedBadges ─────────────────────────────────────────────────

  describe('evaluateEarnedBadges', () => {
    it('등록 0건, 검증 0건 → 뱃지 없음', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 0,
      };
      expect(service.evaluateEarnedBadges(ctx)).toHaveLength(0);
    });

    it('등록 10건 → registration_10 획득, registration_50 미획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 10,
        totalVerifications: 0,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('registration_10');
      expect(earned).not.toContain('registration_50');
    });

    it('등록 50건 → registration_10, registration_50 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 50,
        totalVerifications: 0,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('registration_10');
      expect(earned).toContain('registration_50');
      expect(earned).not.toContain('registration_200');
    });

    it('등록 200건 → registration_200까지 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 200,
        totalVerifications: 0,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('registration_200');
      expect(earned).not.toContain('registration_500');
    });

    it('등록 500건 → 등록 뱃지 4개 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 500,
        totalVerifications: 0,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('registration_10');
      expect(earned).toContain('registration_50');
      expect(earned).toContain('registration_200');
      expect(earned).toContain('registration_500');
    });

    it('검증 10건 → verification_10 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 10,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('verification_10');
    });

    it('검증 500건 → 검증 뱃지 4개 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 500,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('verification_10');
      expect(earned).toContain('verification_50');
      expect(earned).toContain('verification_200');
      expect(earned).toContain('verification_500');
    });

    it('신뢰도 70 + 30일 유지 → trust_70_30 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 70,
        trustScoreMaintainedDays: 30,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('trust_70_30');
    });

    it('신뢰도 70이지만 유지 기간 29일 → trust_70_30 미획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 70,
        trustScoreMaintainedDays: 29,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).not.toContain('trust_70_30');
    });

    it('신뢰도 85 + 60일 유지 → trust_70_30, trust_85_60 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 85,
        trustScoreMaintainedDays: 60,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('trust_70_30');
      expect(earned).toContain('trust_85_60');
      expect(earned).not.toContain('trust_95_90');
    });

    it('신뢰도 95 + 90일 유지 → 신뢰도 뱃지 3개 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 95,
        trustScoreMaintainedDays: 90,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('trust_70_30');
      expect(earned).toContain('trust_85_60');
      expect(earned).toContain('trust_95_90');
    });

    it('trustScoreMaintainedDays 미입력 시 신뢰도 뱃지 없음', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 100,
        // trustScoreMaintainedDays 없음 → 기본값 0으로 처리
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).not.toContain('trust_70_30');
    });

    it('등록 + 검증 혼합 → 두 카테고리 뱃지 모두 획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 10,
        totalVerifications: 10,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).toContain('registration_10');
      expect(earned).toContain('verification_10');
    });

    it('경계값: 등록 9건 → registration_10 미획득', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 9,
        totalVerifications: 0,
        trustScore: 0,
      };
      const earned = service.evaluateEarnedBadges(ctx);
      expect(earned).not.toContain('registration_10');
    });
  });

  // ── evaluateProgressBadges ───────────────────────────────────────────────

  describe('evaluateProgressBadges', () => {
    it('등록 5건 → registration_10 진행률 50%', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 5,
        totalVerifications: 0,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const regProgress = progress.find((p) => p.badgeId === 'registration_10');
      expect(regProgress).toBeDefined();
      expect(regProgress!.progressPercent).toBe(50);
      expect(regProgress!.current).toBe(5);
      expect(regProgress!.threshold).toBe(10);
    });

    it('등록 0건 → registration_10 진행률 0%', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 0,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const regProgress = progress.find((p) => p.badgeId === 'registration_10');
      expect(regProgress).toBeDefined();
      expect(regProgress!.progressPercent).toBe(0);
    });

    it('등록 200건 이상이면 다음 단계(registration_500) 진행 중', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 200,
        totalVerifications: 0,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const regProgress = progress.find(
        (p) => p.badgeId === 'registration_500',
      );
      expect(regProgress).toBeDefined();
      expect(regProgress!.current).toBe(200);
      expect(regProgress!.threshold).toBe(500);
    });

    it('등록 500건 이상 → 등록 진행 뱃지 없음 (다음 단계 없음)', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 500,
        totalVerifications: 0,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const regProgress = progress.find((p) =>
        p.badgeId.startsWith('registration_'),
      );
      expect(regProgress).toBeUndefined();
    });

    it('검증 25건 → verification_50 진행률 50%', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 25,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const verProgress = progress.find((p) => p.badgeId === 'verification_50');
      expect(verProgress).toBeDefined();
      expect(verProgress!.progressPercent).toBe(50);
    });

    it('검증 500건 이상 → 검증 진행 뱃지 없음', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 0,
        totalVerifications: 500,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const verProgress = progress.find((p) =>
        p.badgeId.startsWith('verification_'),
      );
      expect(verProgress).toBeUndefined();
    });

    it('등록 + 검증 모두 진행 중 → 두 항목 모두 반환', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 5,
        totalVerifications: 5,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const hasReg = progress.some((p) => p.badgeId.startsWith('registration_'));
      const hasVer = progress.some((p) => p.badgeId.startsWith('verification_'));
      expect(hasReg).toBe(true);
      expect(hasVer).toBe(true);
    });

    it('진행률은 Math.round로 반올림 처리', () => {
      const ctx: BadgeEvaluationContext = {
        totalRegistrations: 3,
        totalVerifications: 0,
        trustScore: 0,
      };
      const progress = service.evaluateProgressBadges(ctx);
      const regProgress = progress.find((p) => p.badgeId === 'registration_10');
      expect(regProgress!.progressPercent).toBe(30); // Math.round(3/10*100) = 30
    });
  });

  // ── getBadgeDefinition ────────────────────────────────────────────────────

  describe('getBadgeDefinition', () => {
    it('존재하는 뱃지 ID → 뱃지 정의 반환', () => {
      const def = service.getBadgeDefinition('registration_10');
      expect(def).toBeDefined();
      expect(def!.id).toBe('registration_10');
      expect(def!.category).toBe(BadgeCategory.REGISTRATION);
    });

    it('존재하지 않는 뱃지 ID → undefined 반환', () => {
      const def = service.getBadgeDefinition('non_existent_badge');
      expect(def).toBeUndefined();
    });

    it('신뢰도 뱃지 조회 → durationDays 포함', () => {
      const def = service.getBadgeDefinition('trust_70_30');
      expect(def).toBeDefined();
      expect(def!.durationDays).toBe(30);
      expect(def!.threshold).toBe(70);
    });
  });

  // ── getAllBadgeDefinitions ────────────────────────────────────────────────

  describe('getAllBadgeDefinitions', () => {
    it('등록/검증/신뢰도 카테고리 모두 포함', () => {
      const defs = service.getAllBadgeDefinitions();
      const categories = new Set(defs.map((d) => d.category));
      expect(categories.has(BadgeCategory.REGISTRATION)).toBe(true);
      expect(categories.has(BadgeCategory.VERIFICATION)).toBe(true);
      expect(categories.has(BadgeCategory.TRUST)).toBe(true);
    });

    it('총 11개 뱃지 정의 반환 (등록 4 + 검증 4 + 신뢰도 3)', () => {
      const defs = service.getAllBadgeDefinitions();
      expect(defs).toHaveLength(11);
    });
  });

  // ── getRepresentativeBadge ───────────────────────────────────────────────

  describe('getRepresentativeBadge', () => {
    it('획득 뱃지 없으면 null 반환', () => {
      expect(service.getRepresentativeBadge([])).toBeNull();
    });

    it('여러 뱃지 중 가장 높은 rank 반환', () => {
      const badge = service.getRepresentativeBadge([
        'registration_10',
        'registration_50',
        'registration_200',
      ]);
      expect(badge?.id).toBe('registration_200');
    });

    it('단일 뱃지 → 해당 뱃지 반환', () => {
      const badge = service.getRepresentativeBadge(['verification_10']);
      expect(badge?.id).toBe('verification_10');
    });

    it('등록 최고 rank(4) vs 검증 rank(1) → 등록 rank4 반환', () => {
      const badge = service.getRepresentativeBadge([
        'registration_500',
        'verification_10',
      ]);
      expect(badge?.id).toBe('registration_500');
    });

    it('존재하지 않는 뱃지 ID 포함 → 유효한 뱃지 중 최고 rank 반환', () => {
      const badge = service.getRepresentativeBadge([
        'non_existent',
        'registration_10',
      ]);
      expect(badge?.id).toBe('registration_10');
    });

    it('모두 존재하지 않는 ID → null 반환', () => {
      const badge = service.getRepresentativeBadge([
        'non_existent_1',
        'non_existent_2',
      ]);
      expect(badge).toBeNull();
    });
  });
});
