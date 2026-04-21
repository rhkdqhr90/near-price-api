import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { PriceReactionService } from './price-reaction.service';
import {
  PriceReaction,
  PriceReactionType,
} from './entities/price-reaction.entity';
import { Price } from '../price/entities/price.entity';
import { User, UserRole } from '../user/entities/user.entity';
import { UnitType } from '../product/entities/product.entity';

describe('PriceReactionService', () => {
  let service: PriceReactionService;
  let reactionRepository: jest.Mocked<Repository<PriceReaction>>;
  let priceRepository: jest.Mocked<Repository<Price>>;
  let mockManager: any;
  let dataSource: jest.Mocked<DataSource>;

  // ── 공통 fixture ──────────────────────────────────────────────────────────

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
    unitType: UnitType.OTHER,
    imageUrl: 'https://example.com/image.jpg',
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
    priceTagType: 'normal',
    originalPrice: null,
    bundleType: null,
    bundleQty: null,
    flatGroupName: null,
    memberPrice: null,
    endsAt: null,
    cardLabel: null,
    cardDiscountType: null,
    cardDiscountValue: null,
    cardConditionNote: null,
    note: null,
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
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PriceReactionService>(PriceReactionService);
    reactionRepository = module.get(getRepositoryToken(PriceReaction));
    priceRepository = module.get(getRepositoryToken(Price));
    dataSource = module.get(DataSource);

    // transaction manager mock — 각 테스트에서 mockManager를 통해 동작 주입
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    (dataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (em: any) => Promise<any>) => cb(mockManager),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // confirm()
  // =========================================================================

  describe('confirm()', () => {
    it('기존 반응 없음 → CONFIRM 생성', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null) // existing reaction 없음
        .mockResolvedValueOnce(mockPrice); // price 조회
      const newReaction = makeReaction(PriceReactionType.CONFIRM);
      mockManager.create.mockReturnValue(newReaction);
      mockManager.save.mockResolvedValue(newReaction);

      await service.confirm(mockPrice.id, mockUser.id);

      expect(mockManager.create).toHaveBeenCalledWith(PriceReaction, {
        price: mockPrice,
        user: { id: mockUser.id },
        type: PriceReactionType.CONFIRM,
        reason: null,
      });
      expect(mockManager.save).toHaveBeenCalledWith(newReaction);
    });

    it('이미 CONFIRM → remove로 토글(삭제)', async () => {
      const existingConfirm = makeReaction(PriceReactionType.CONFIRM);
      mockManager.findOne.mockResolvedValueOnce(existingConfirm);
      mockManager.remove.mockResolvedValue(existingConfirm);

      await service.confirm(mockPrice.id, mockUser.id);

      expect(mockManager.remove).toHaveBeenCalledWith(existingConfirm);
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('이미 REPORT → type을 CONFIRM으로 변경', async () => {
      const existingReport = makeReaction(
        PriceReactionType.REPORT,
        '가격 틀림',
      );
      mockManager.findOne.mockResolvedValueOnce(existingReport);
      mockManager.save.mockResolvedValue({
        ...existingReport,
        type: PriceReactionType.CONFIRM,
        reason: null,
      });

      await service.confirm(mockPrice.id, mockUser.id);

      expect(mockManager.remove).not.toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PriceReactionType.CONFIRM,
          reason: null,
        }),
      );
    });

    it('price 없음 → NotFoundException을 던진다', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null) // existing reaction 없음
        .mockResolvedValueOnce(null); // price 없음

      await expect(
        service.confirm('nonexistent-price-id', mockUser.id),
      ).rejects.toThrow(NotFoundException);

      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.confirm('nonexistent-price-id', mockUser.id),
      ).rejects.toThrow('가격 정보가 없습니다.');
    });

    it('본인 가격 → ForbiddenException을 던진다', async () => {
      const ownPrice = { ...mockPrice, user: { ...mockUser } };
      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ownPrice);

      await expect(service.confirm(ownPrice.id, mockUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =========================================================================
  // report()
  // =========================================================================

  describe('report()', () => {
    const reason = '가격 틀림';

    it('기존 반응 없음 → REPORT 생성', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockPrice);
      const newReaction = makeReaction(PriceReactionType.REPORT, reason);
      mockManager.create.mockReturnValue(newReaction);
      mockManager.save.mockResolvedValue(newReaction);

      await service.report(mockPrice.id, mockUser.id, reason);

      expect(mockManager.create).toHaveBeenCalledWith(PriceReaction, {
        price: mockPrice,
        user: { id: mockUser.id },
        type: PriceReactionType.REPORT,
        reason,
      });
      expect(mockManager.save).toHaveBeenCalledWith(newReaction);
    });

    it('이미 REPORT → ConflictException을 던진다', async () => {
      const existingReport = makeReaction(PriceReactionType.REPORT, reason);
      mockManager.findOne.mockResolvedValueOnce(existingReport);

      await expect(
        service.report(mockPrice.id, mockUser.id, reason),
      ).rejects.toThrow(ConflictException);

      mockManager.findOne.mockResolvedValueOnce(existingReport);

      await expect(
        service.report(mockPrice.id, mockUser.id, reason),
      ).rejects.toThrow('이미 신고한 가격입니다.');
    });

    it('이미 CONFIRM → type을 REPORT로 변경', async () => {
      const existingConfirm = makeReaction(PriceReactionType.CONFIRM);
      mockManager.findOne.mockResolvedValueOnce(existingConfirm);
      mockManager.save.mockResolvedValue({
        ...existingConfirm,
        type: PriceReactionType.REPORT,
        reason,
      });

      await service.report(mockPrice.id, mockUser.id, reason);

      expect(mockManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ type: PriceReactionType.REPORT, reason }),
      );
    });

    it('price 없음 → NotFoundException을 던진다', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.report('nonexistent-price-id', mockUser.id, reason),
      ).rejects.toThrow(NotFoundException);

      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.report('nonexistent-price-id', mockUser.id, reason),
      ).rejects.toThrow('가격 정보가 없습니다.');
    });

    it('본인 가격 → ForbiddenException을 던진다', async () => {
      const ownPrice = { ...mockPrice, user: { ...mockUser } };
      mockManager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(ownPrice);

      await expect(
        service.report(ownPrice.id, mockUser.id, reason),
      ).rejects.toThrow(ForbiddenException);
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

  // trustScore 재계산은 TrustScoreScheduler(매일 03:00)가 전담 (CLAUDE.md 규칙10)
  // PriceReactionService는 TrustScoreService를 주입받지 않음
});
