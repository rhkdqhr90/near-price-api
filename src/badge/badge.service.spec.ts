import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BadgeService } from './badge.service';
import { User, UserRole } from '../user/entities/user.entity';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';

const USER_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INVALID_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

function buildUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = USER_UUID;
  user.email = 'test@example.com';
  user.nickname = '테스터';
  user.latitude = null;
  user.longitude = null;
  user.role = UserRole.USER;
  user.profileImageUrl = null;
  user.fcmToken = null;
  user.notifPriceChange = true;
  user.notifPromotion = false;
  user.nicknameChangedAt = null;
  user.trustScore = 30;
  user.oauths = [];
  user.prices = [];
  user.wishlists = [];
  user.createdAt = new Date('2025-01-01');
  user.updatedAt = new Date('2025-01-01');
  return Object.assign(user, overrides);
}

function buildTrustScore(user: User, overrides: Partial<UserTrustScore> = {}): UserTrustScore {
  const ts = new UserTrustScore();
  ts.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  ts.user = user;
  ts.trustScore = 75;
  ts.registrationScore = 60;
  ts.verificationScore = 80;
  ts.consistencyBonus = 5;
  ts.totalRegistrations = 10;
  ts.totalVerifications = 8;
  ts.createdAt = new Date('2025-01-01');
  ts.calculatedAt = new Date('2025-06-01');
  return Object.assign(ts, overrides);
}

describe('BadgeService', () => {
  let service: BadgeService;
  let userRepo: jest.Mocked<Repository<User>>;
  let trustScoreRepo: jest.Mocked<Repository<UserTrustScore>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgeService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserTrustScore),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BadgeService>(BadgeService);
    userRepo = module.get(getRepositoryToken(User));
    trustScoreRepo = module.get(getRepositoryToken(UserTrustScore));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserTrustScore()', () => {
    it('user가 존재하고 UserTrustScore도 있는 경우 → 정상 반환', async () => {
      const user = buildUser();
      const trustScore = buildTrustScore(user);

      userRepo.findOne.mockResolvedValue(user);
      trustScoreRepo.findOne.mockResolvedValue(trustScore);

      const result = await service.getUserTrustScore(USER_UUID);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: USER_UUID } });
      expect(trustScoreRepo.findOne).toHaveBeenCalledWith({
        where: { user: { id: USER_UUID } },
      });
      expect(result.userId).toBe(USER_UUID);
      expect(result.trustScore).toBe(75);
      expect(result.registrationScore).toBe(60);
      expect(result.verificationScore).toBe(80);
      expect(result.consistencyBonus).toBe(5);
      expect(result.totalRegistrations).toBe(10);
      expect(result.totalVerifications).toBe(8);
      expect(result.calculatedAt).toEqual(new Date('2025-06-01'));
    });

    it('user가 존재하지 않는 경우 → NotFoundException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserTrustScore(INVALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserTrustScore(INVALID_UUID)).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
      expect(trustScoreRepo.findOne).not.toHaveBeenCalled();
    });

    it('user는 있지만 UserTrustScore가 없는 경우 → user.trustScore 폴백 값으로 반환', async () => {
      const user = buildUser({ trustScore: 30 });

      userRepo.findOne.mockResolvedValue(user);
      trustScoreRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserTrustScore(USER_UUID);

      expect(result.userId).toBe(USER_UUID);
      expect(result.trustScore).toBe(30);
      expect(result.registrationScore).toBe(50);
      expect(result.verificationScore).toBe(50);
      expect(result.consistencyBonus).toBe(0);
      expect(result.totalRegistrations).toBe(0);
      expect(result.totalVerifications).toBe(0);
    });
  });
});
