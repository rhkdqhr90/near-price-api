import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { PriceReactionService } from './price-reaction.service';
import {
  PriceReaction,
  PriceReactionType,
} from './entities/price-reaction.entity';
import { Price } from '../price/entities/price.entity';
import { User, UserRole } from '../user/entities/user.entity';

// createQueryBuilder 체인 mock 헬퍼
function makeQbMock(rawResult: { score: string }) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawResult),
  } as unknown as SelectQueryBuilder<PriceReaction>;
  return qb;
}

describe('PriceReactionService', () => {
  let service: PriceReactionService;
  let reactionRepository: jest.Mocked<Repository<PriceReaction>>;
  let priceRepository: jest.Mocked<Repository<Price>>;
  let userRepository: jest.Mocked<Repository<User>>;

  // ── 공통 fixture ──────────────────────────────────────────────────────────

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    nickname: '테스트유저',
    profileImageUrl: null,
    fcmToken: null,
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

  const mockPriceOwner: User = {
    ...mockUser,
    id: 'owner-uuid-1',
    email: 'owner@example.com',
    nickname: '가격등록자',
  };

  const mockPrice: Price = {
    id: 'price-uuid-1',
    user: mockPriceOwner,
    store: {} as any,
    product: {} as any,
    price: 1000,
    quantity: null,
    imageUrl: 'https://example.com/image.jpg',
    saleStartDate: null as any,
    saleEndDate: null as any,
    condition: null as any,
    isActive: true,
    likeCount: 0,
    reportCount: 0,
    trustScore: null,
    verificationCount: 0,
    confirmedCount: 0,
    disputedCount: 0,
    sourceVerificationId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const makeReaction = (
    type: PriceReactionType,
    reason: string | null = null,
  ): PriceReaction => ({
    id: 'reaction-uuid-1',
    price: mockPrice,
    user: mockUser,
    type,
    reason,
    createdAt: new Date('2026-01-01'),
  });

  // ── beforeEach ────────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceReactionService,
        {
          provide: getRepositoryToken(PriceReaction),
          useValue: {
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
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
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PriceReactionService>(PriceReactionService);
    reactionRepository = module.get(getRepositoryToken(PriceReaction));
    priceRepository = module.get(getRepositoryToken(Price));
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── recalculateTrustScore mock 헬퍼 ──────────────────────────────────────
  // 간접 검증을 위해 createQueryBuilder 체인을 자동 설정

  function setupRecalculateMock(score = '1') {
    const qb = makeQbMock({ score });
    reactionRepository.createQueryBuilder.mockReturnValue(qb as any);
    userRepository.update.mockResolvedValue({ affected: 1 } as any);
    return qb;
  }

  // =========================================================================
  // confirm()
  // =========================================================================

  describe('confirm()', () => {
    it('기존 반응 없음 → CONFIRM 생성 후 trustScore 재계산을 호출한다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(mockPrice);
      const newReaction = makeReaction(PriceReactionType.CONFIRM);
      reactionRepository.create.mockReturnValue(newReaction);
      reactionRepository.save.mockResolvedValue(newReaction);
      const qb = setupRecalculateMock('1');

      await service.confirm(mockPrice.id, mockUser.id);

      expect(reactionRepository.create).toHaveBeenCalledWith({
        price: mockPrice,
        user: { id: mockUser.id },
        type: PriceReactionType.CONFIRM,
        reason: null,
      });
      expect(reactionRepository.save).toHaveBeenCalledWith(newReaction);
      // recalculateTrustScore 호출 확인
      expect(reactionRepository.createQueryBuilder).toHaveBeenCalledWith('pr');
      expect(qb.where).toHaveBeenCalledWith('u.id = :targetUserId', {
        targetUserId: mockPriceOwner.id,
      });
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: 1 },
      );
    });

    it('이미 CONFIRM → remove로 토글(삭제)하고 trustScore 재계산을 호출한다', async () => {
      const existingConfirm = makeReaction(PriceReactionType.CONFIRM);
      reactionRepository.findOne.mockResolvedValue(existingConfirm);
      reactionRepository.remove.mockResolvedValue(existingConfirm);
      const qb = setupRecalculateMock('0');

      await service.confirm(mockPrice.id, mockUser.id);

      expect(reactionRepository.remove).toHaveBeenCalledWith(existingConfirm);
      expect(reactionRepository.save).not.toHaveBeenCalled();
      // trustScore 재계산 호출 확인
      expect(reactionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: 0 },
      );
    });

    it('이미 REPORT → type을 CONFIRM으로 변경하고 trustScore 재계산을 호출한다', async () => {
      const existingReport = makeReaction(
        PriceReactionType.REPORT,
        '가격 틀림',
      );
      reactionRepository.findOne.mockResolvedValue(existingReport);
      reactionRepository.save.mockResolvedValue({
        ...existingReport,
        type: PriceReactionType.CONFIRM,
        reason: null,
      });
      const qb = setupRecalculateMock('1');

      await service.confirm(mockPrice.id, mockUser.id);

      expect(reactionRepository.remove).not.toHaveBeenCalled();
      expect(reactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PriceReactionType.CONFIRM,
          reason: null,
        }),
      );
      // trustScore 재계산 호출 확인
      expect(reactionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: 1 },
      );
    });

    it('price 없음 → NotFoundException을 던진다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent-price-id', mockUser.id),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.confirm('nonexistent-price-id', mockUser.id),
      ).rejects.toThrow('가격 정보가 없습니다.');
    });
  });

  // =========================================================================
  // report()
  // =========================================================================

  describe('report()', () => {
    const reason = '가격 틀림';

    it('기존 반응 없음 → REPORT 생성 후 trustScore 재계산을 호출한다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(mockPrice);
      const newReaction = makeReaction(PriceReactionType.REPORT, reason);
      reactionRepository.create.mockReturnValue(newReaction);
      reactionRepository.save.mockResolvedValue(newReaction);
      const qb = setupRecalculateMock('-2');

      await service.report(mockPrice.id, mockUser.id, reason);

      expect(reactionRepository.create).toHaveBeenCalledWith({
        price: mockPrice,
        user: { id: mockUser.id },
        type: PriceReactionType.REPORT,
        reason,
      });
      expect(reactionRepository.save).toHaveBeenCalledWith(newReaction);
      // trustScore 재계산 호출 확인
      expect(reactionRepository.createQueryBuilder).toHaveBeenCalledWith('pr');
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: -2 },
      );
    });

    it('이미 REPORT → ConflictException을 던진다', async () => {
      const existingReport = makeReaction(PriceReactionType.REPORT, reason);
      reactionRepository.findOne.mockResolvedValue(existingReport);

      await expect(
        service.report(mockPrice.id, mockUser.id, reason),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.report(mockPrice.id, mockUser.id, reason),
      ).rejects.toThrow('이미 신고한 가격입니다.');
    });

    it('이미 CONFIRM → type을 REPORT로 변경하고 trustScore 재계산을 호출한다', async () => {
      const existingConfirm = makeReaction(PriceReactionType.CONFIRM);
      reactionRepository.findOne.mockResolvedValue(existingConfirm);
      reactionRepository.save.mockResolvedValue({
        ...existingConfirm,
        type: PriceReactionType.REPORT,
        reason,
      });
      const qb = setupRecalculateMock('-1');

      await service.report(mockPrice.id, mockUser.id, reason);

      expect(reactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PriceReactionType.REPORT,
          reason,
        }),
      );
      // trustScore 재계산 호출 확인
      expect(reactionRepository.createQueryBuilder).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: -1 },
      );
    });

    it('price 없음 → NotFoundException을 던진다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.report('nonexistent-price-id', mockUser.id, reason),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.report('nonexistent-price-id', mockUser.id, reason),
      ).rejects.toThrow('가격 정보가 없습니다.');
    });
  });

  // =========================================================================
  // getReactions()
  // =========================================================================

  describe('getReactions()', () => {
    it('미인증 (userId=null) → myReaction이 null이다', async () => {
      reactionRepository.count
        .mockResolvedValueOnce(3) // confirmCount
        .mockResolvedValueOnce(1); // reportCount

      const result = await service.getReactions(mockPrice.id, null);

      expect(result.myReaction).toBeNull();
      // userId 없으므로 개별 findOne 호출 없음
      expect(reactionRepository.findOne).not.toHaveBeenCalled();
    });

    it('인증됨, 반응 없음 → myReaction이 null이다', async () => {
      reactionRepository.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      reactionRepository.findOne.mockResolvedValue(null);

      const result = await service.getReactions(mockPrice.id, mockUser.id);

      expect(result.myReaction).toBeNull();
    });

    it('인증됨, CONFIRM 반응 있음 → myReaction이 "confirm"이다', async () => {
      reactionRepository.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);
      reactionRepository.findOne.mockResolvedValue(
        makeReaction(PriceReactionType.CONFIRM),
      );

      const result = await service.getReactions(mockPrice.id, mockUser.id);

      expect(result.myReaction).toBe(PriceReactionType.CONFIRM);
      expect(result.myReaction).toBe('confirm');
    });

    it('confirmCount와 reportCount를 정확히 반환한다', async () => {
      reactionRepository.count
        .mockResolvedValueOnce(7) // confirmCount
        .mockResolvedValueOnce(2); // reportCount
      reactionRepository.findOne.mockResolvedValue(null);

      const result = await service.getReactions(mockPrice.id, mockUser.id);

      expect(result.confirmCount).toBe(7);
      expect(result.reportCount).toBe(2);
    });

    it('미인증 시 confirmCount와 reportCount는 정상 반환된다', async () => {
      reactionRepository.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      const result = await service.getReactions(mockPrice.id, null);

      expect(result.confirmCount).toBe(4);
      expect(result.reportCount).toBe(1);
      expect(result.myReaction).toBeNull();
    });
  });

  // =========================================================================
  // recalculateTrustScore() — confirm/report 통해 간접 검증
  // =========================================================================

  describe('recalculateTrustScore() 간접 검증', () => {
    it('confirm 후 createQueryBuilder → score 파싱 → userRepository.update 순으로 호출된다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(mockPrice);
      const newReaction = makeReaction(PriceReactionType.CONFIRM);
      reactionRepository.create.mockReturnValue(newReaction);
      reactionRepository.save.mockResolvedValue(newReaction);

      const qb = makeQbMock({ score: '3' });
      reactionRepository.createQueryBuilder.mockReturnValue(qb as any);
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.confirm(mockPrice.id, mockUser.id);

      expect(reactionRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.select).toHaveBeenCalledTimes(1);
      expect(qb.innerJoin).toHaveBeenCalledTimes(2);
      expect(qb.where).toHaveBeenCalledTimes(1);
      expect(qb.andWhere).toHaveBeenCalledWith('p.isActive = :isActive', {
        isActive: true,
      });
      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: 3 },
      );
    });

    it('report 후 createQueryBuilder → score 파싱 → userRepository.update 순으로 호출된다', async () => {
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(mockPrice);
      const newReaction = makeReaction(PriceReactionType.REPORT, '허위 정보');
      reactionRepository.create.mockReturnValue(newReaction);
      reactionRepository.save.mockResolvedValue(newReaction);

      const qb = makeQbMock({ score: '-4' });
      reactionRepository.createQueryBuilder.mockReturnValue(qb as any);
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.report(mockPrice.id, mockUser.id, '허위 정보');

      expect(reactionRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.getRawOne).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockPriceOwner.id },
        { trustScore: -4 },
      );
    });

    it('price.user가 없으면 recalculateTrustScore를 호출하지 않는다', async () => {
      const priceWithoutOwner: Price = { ...mockPrice, user: null as any };
      reactionRepository.findOne.mockResolvedValue(null);
      priceRepository.findOne.mockResolvedValue(priceWithoutOwner);
      const newReaction = makeReaction(PriceReactionType.CONFIRM);
      reactionRepository.create.mockReturnValue(newReaction);
      reactionRepository.save.mockResolvedValue(newReaction);

      await service.confirm(priceWithoutOwner.id, mockUser.id);

      expect(reactionRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });
});
