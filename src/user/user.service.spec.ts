import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserService } from './user.service';
import { User, UserRole } from './entities/user.entity';
import { UserOauth } from './entities/user-oauth.entity';
import { Price } from '../price/entities/price.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { MyProfileResponseDto } from './dto/my-profile-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser } from '../auth/types/auth-user.type';

// containsBannedWords 모킹
jest.mock('../common/constants/banned-words', () => ({
  containsBannedWords: jest.fn(),
}));
import { containsBannedWords } from '../common/constants/banned-words';
const mockContainsBannedWords = containsBannedWords as jest.MockedFunction<
  typeof containsBannedWords
>;

// ─── 헬퍼: 기본 User 객체 생성 ───────────────────────────────────────────────
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id-1',
    email: 'test@example.com',
    nickname: 'testnick',
    latitude: null,
    longitude: null,
    role: UserRole.USER,
    profileImageUrl: null,
    fcmToken: null,
    notifPriceChange: true,
    notifPromotion: false,
    nicknameChangedAt: null,
    trustScore: 0,
    oauths: [],
    prices: [],
    wishlists: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as User;
}

// ─── 헬퍼: AuthUser 생성 ──────────────────────────────────────────────────────
function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: 'user-id-1',
    email: 'test@example.com',
    role: UserRole.USER,
    ...overrides,
  };
}

// ─── 헬퍼: QueryBuilder mock ─────────────────────────────────────────────────
function makeQueryBuilder() {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
  return qb;
}

// ─── Repository Mock 타입 ────────────────────────────────────────────────────

type MockRepository<_T = any> = Partial<
  Record<keyof Repository<any>, jest.Mock>
>;

function createMockRepository<T>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('UserService', () => {
  let service: UserService;
  let userRepo: MockRepository<User>;
  let priceRepo: MockRepository<Price>;
  let userOauthRepo: MockRepository<UserOauth>;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    userRepo = createMockRepository<User>();
    priceRepo = createMockRepository<Price>();
    userOauthRepo = createMockRepository<UserOauth>();
    mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Price), useValue: priceRepo },
        { provide: getRepositoryToken(UserOauth), useValue: userOauthRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    // 기본값: 금칙어 없음
    mockContainsBannedWords.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('유저를 생성하고 UserResponseDto를 반환한다', async () => {
      const dto: CreateUserDto = {
        email: 'new@example.com',
        nickname: 'newuser',
      };
      const user = makeUser({ email: dto.email, nickname: dto.nickname });
      userRepo.create!.mockReturnValue(user);
      userRepo.save!.mockResolvedValue(user);

      const result = await service.create(dto);

      expect(userRepo.create).toHaveBeenCalledWith(dto);
      expect(userRepo.save).toHaveBeenCalledWith(user);
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.nickname).toBe(dto.nickname);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('유저 목록을 PaginatedResponseDto로 반환한다', async () => {
      const users = [
        makeUser(),
        makeUser({ id: 'user-id-2', email: 'b@b.com', nickname: 'b' }),
      ];
      userRepo.findAndCount!.mockResolvedValue([users, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(userRepo.findAndCount).toHaveBeenCalledWith({ skip: 0, take: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0]).toBeInstanceOf(UserResponseDto);
    });

    it('유저가 없으면 빈 data를 반환한다', async () => {
      userRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findMe
  // ─────────────────────────────────────────────────────────────────────────
  describe('findMe', () => {
    it('존재하는 유저를 MyProfileResponseDto로 반환한다 (email, profileImageUrl 포함)', async () => {
      const user = makeUser({
        email: 'me@example.com',
        profileImageUrl: 'https://img.example.com/me.jpg',
      });
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.findMe('user-id-1');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
      });
      expect(result).toBeInstanceOf(MyProfileResponseDto);
      expect(result.id).toBe('user-id-1');
      expect(result.email).toBe('me@example.com');
      expect(result.profileImageUrl).toBe('https://img.example.com/me.jpg');
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.findMe('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('profileImageUrl이 null이면 null을 반환한다', async () => {
      const user = makeUser({ profileImageUrl: null });
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.findMe('user-id-1');

      expect(result.profileImageUrl).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('존재하는 유저를 UserResponseDto로 반환한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.findOne('user-id-1');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
      });
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe('user-id-1');
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findByEmail
  // ─────────────────────────────────────────────────────────────────────────
  describe('findByEmail', () => {
    it('이메일로 유저를 반환한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toBe(user);
    });

    it('존재하지 않으면 null을 반환한다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.findByEmail('none@example.com');

      expect(result).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    const updateDto: UpdateUserDto = { nickname: 'updated' };

    it('본인이 정보를 수정하면 UserResponseDto를 반환한다', async () => {
      const user = makeUser();
      const saved = makeUser({ nickname: 'updated' });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(saved);

      const requestUser = makeAuthUser();
      const result = await service.update('user-id-1', updateDto, requestUser);

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.nickname).toBe('updated');
    });

    it('ADMIN은 다른 유저 정보를 수정할 수 있다', async () => {
      const user = makeUser({ id: 'other-id' });
      const saved = makeUser({ id: 'other-id', nickname: 'updated' });
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(saved);

      const admin = makeAuthUser({ userId: 'admin-id', role: UserRole.ADMIN });
      const result = await service.update('other-id', updateDto, admin);

      expect(result).toBeInstanceOf(UserResponseDto);
    });

    it('본인이 아니고 ADMIN도 아니면 ForbiddenException을 던진다', async () => {
      const requestUser = makeAuthUser({ userId: 'different-user' });

      await expect(
        service.update('user-id-1', updateDto, requestUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('유저가 존재하지 않으면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const requestUser = makeAuthUser();

      await expect(
        service.update('user-id-1', updateDto, requestUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('유저를 삭제한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.remove!.mockResolvedValue(user);

      await service.remove('user-id-1');

      expect(userRepo.remove).toHaveBeenCalledWith(user);
    });

    it('존재하지 않는 유저면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkNicknameAvailable
  // ─────────────────────────────────────────────────────────────────────────
  describe('checkNicknameAvailable', () => {
    it('닉네임이 사용 가능하면 true를 반환한다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const result = await service.checkNicknameAvailable('available-nick');

      expect(result).toBe(true);
    });

    it('닉네임이 이미 사용 중이면 false를 반환한다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser({ nickname: 'taken-nick' }));

      const result = await service.checkNicknameAvailable('taken-nick');

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateNickname
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateNickname', () => {
    it('정상적으로 닉네임을 변경한다', async () => {
      const user = makeUser({ nicknameChangedAt: null });
      const saved = makeUser({ nickname: 'newnick' });
      userRepo
        .findOne!.mockResolvedValueOnce(user) // findOne for user
        .mockResolvedValueOnce(null); // checkNicknameAvailable
      userRepo.save!.mockResolvedValue(saved);

      const result = await service.updateNickname(
        'user-id-1',
        'newnick',
        makeAuthUser(),
      );

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.nickname).toBe('newnick');
    });

    it('본인이 아니고 ADMIN도 아니면 ForbiddenException을 던진다', async () => {
      const requestUser = makeAuthUser({ userId: 'other-user' });

      await expect(
        service.updateNickname('user-id-1', 'newnick', requestUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('유저가 존재하지 않으면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.updateNickname('user-id-1', 'newnick', makeAuthUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('공백으로만 이루어진 닉네임이면 BadRequestException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());

      await expect(
        service.updateNickname('user-id-1', '   ', makeAuthUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('빈 문자열 닉네임이면 BadRequestException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());

      await expect(
        service.updateNickname('user-id-1', '', makeAuthUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('3일 이내 변경 시도 시 BadRequestException을 던진다', async () => {
      const recentChange = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1일 전
      const user = makeUser({ nicknameChangedAt: recentChange });
      userRepo.findOne!.mockResolvedValue(user);

      await expect(
        service.updateNickname('user-id-1', 'newnick', makeAuthUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('3일이 지난 후에는 닉네임 변경이 가능하다', async () => {
      const oldChange = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4일 전
      const user = makeUser({ nicknameChangedAt: oldChange });
      const saved = makeUser({ nickname: 'newnick' });
      userRepo.findOne!.mockResolvedValueOnce(user).mockResolvedValueOnce(null); // checkNicknameAvailable
      userRepo.save!.mockResolvedValue(saved);

      const result = await service.updateNickname(
        'user-id-1',
        'newnick',
        makeAuthUser(),
      );

      expect(result).toBeInstanceOf(UserResponseDto);
    });

    it('금칙어가 포함된 닉네임이면 BadRequestException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());
      mockContainsBannedWords.mockReturnValue(true);

      await expect(
        service.updateNickname('user-id-1', 'admin123', makeAuthUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('이미 사용 중인 닉네임이면 ConflictException을 던진다', async () => {
      const user = makeUser();
      // 첫 번째 findOne: 유저 조회, 두 번째 findOne: checkNicknameAvailable
      userRepo
        .findOne!.mockResolvedValueOnce(user)
        .mockResolvedValueOnce(makeUser({ id: 'other-id', nickname: 'taken' }));

      await expect(
        service.updateNickname('user-id-1', 'taken', makeAuthUser()),
      ).rejects.toThrow(ConflictException);
    });

    it('현재 닉네임과 동일한 경우 중복 체크를 스킵하고 저장한다', async () => {
      const user = makeUser({ nickname: 'testnick', nicknameChangedAt: null });
      const saved = makeUser({ nickname: 'testnick' });
      // findOne 한 번만 호출 (checkNicknameAvailable 스킵)
      userRepo.findOne!.mockResolvedValueOnce(user);
      userRepo.save!.mockResolvedValue(saved);

      const result = await service.updateNickname(
        'user-id-1',
        'testnick',
        makeAuthUser(),
      );

      expect(result).toBeInstanceOf(UserResponseDto);
      // findOne이 1번만 호출됐는지 확인 (중복체크 스킵)
      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('ADMIN은 다른 유저 닉네임을 변경할 수 있다', async () => {
      const user = makeUser({ id: 'other-id', nickname: 'oldnick' });
      const saved = makeUser({ id: 'other-id', nickname: 'newnick' });
      userRepo.findOne!.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      userRepo.save!.mockResolvedValue(saved);

      const admin = makeAuthUser({ userId: 'admin-id', role: UserRole.ADMIN });
      const result = await service.updateNickname('other-id', 'newnick', admin);

      expect(result).toBeInstanceOf(UserResponseDto);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateFcmToken
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateFcmToken', () => {
    it('본인 FCM 토큰을 업데이트하면 success: true를 반환한다', async () => {
      userRepo.update!.mockResolvedValue({ affected: 1 });

      const result = await service.updateFcmToken(
        'user-id-1',
        'new-token',
        makeAuthUser(),
      );

      expect(userRepo.update).toHaveBeenCalledWith('user-id-1', {
        fcmToken: 'new-token',
      });
      expect(result).toEqual({ success: true });
    });

    it('타인의 FCM 토큰을 변경하면 ForbiddenException을 던진다', async () => {
      const requestUser = makeAuthUser({ userId: 'other-user' });

      await expect(
        service.updateFcmToken('user-id-1', 'new-token', requestUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateNotificationSettings
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateNotificationSettings', () => {
    it('본인 알림 설정을 변경하면 success: true를 반환한다', async () => {
      userRepo.update!.mockResolvedValue({ affected: 1 });

      const result = await service.updateNotificationSettings(
        'user-id-1',
        { notifPriceChange: false, notifPromotion: true },
        makeAuthUser(),
      );

      expect(userRepo.update).toHaveBeenCalledWith('user-id-1', {
        notifPriceChange: false,
        notifPromotion: true,
      });
      expect(result).toEqual({ success: true });
    });

    it('일부 알림 설정만 전달해도 업데이트된다', async () => {
      userRepo.update!.mockResolvedValue({ affected: 1 });

      const result = await service.updateNotificationSettings(
        'user-id-1',
        { notifPriceChange: true },
        makeAuthUser(),
      );

      expect(result).toEqual({ success: true });
    });

    it('타인의 알림 설정을 변경하면 ForbiddenException을 던진다', async () => {
      const requestUser = makeAuthUser({ userId: 'other-user' });

      await expect(
        service.updateNotificationSettings(
          'user-id-1',
          { notifPromotion: true },
          requestUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteAccount
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteAccount', () => {
    function makeTransactionManager() {
      const qb = makeQueryBuilder();
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        _qb: qb,
      };
      return manager;
    }

    it('본인 계정을 삭제한다 — 트랜잭션 콜백 실행', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const manager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      await service.deleteAccount('user-id-1', makeAuthUser());

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('트랜잭션 내 Price.user를 null로 익명화한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const manager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      await service.deleteAccount('user-id-1', makeAuthUser());

      const qb = manager._qb;
      expect(manager.createQueryBuilder).toHaveBeenCalled();
      expect(qb.update).toHaveBeenCalledWith(Price);
      expect(qb.set).toHaveBeenCalledWith({ user: null });
      expect(qb.where).toHaveBeenCalledWith('user_id = :userId', {
        userId: 'user-id-1',
      });
      expect(qb.execute).toHaveBeenCalled();
    });

    it('트랜잭션 내 UserOauth를 삭제한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const manager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      await service.deleteAccount('user-id-1', makeAuthUser());

      expect(manager.delete).toHaveBeenCalledWith(UserOauth, {
        user: { id: 'user-id-1' },
      });
    });

    it('트랜잭션 내 User를 삭제한다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const manager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      await service.deleteAccount('user-id-1', makeAuthUser());

      expect(manager.delete).toHaveBeenCalledWith(User, { id: 'user-id-1' });
    });

    it('트랜잭션 내 순서: Price 익명화 → UserOauth 삭제 → User 삭제', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const callOrder: string[] = [];
      const qb = makeQueryBuilder();
      qb.execute = jest.fn().mockImplementation(() => {
        callOrder.push('price-anonymize');
        return Promise.resolve({});
      });
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        delete: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === UserOauth) callOrder.push('oauth-delete');
          if (entity === User) callOrder.push('user-delete');
          return Promise.resolve({ affected: 1 });
        }),
      };
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      await service.deleteAccount('user-id-1', makeAuthUser());

      expect(callOrder).toEqual([
        'price-anonymize',
        'oauth-delete',
        'user-delete',
      ]);
    });

    it('타인 계정을 삭제하려 하면 ForbiddenException을 던진다', async () => {
      const requestUser = makeAuthUser({ userId: 'other-user' });

      await expect(
        service.deleteAccount('user-id-1', requestUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ForbiddenException 시 userRepository.findOne을 호출하지 않는다', async () => {
      const requestUser = makeAuthUser({ userId: 'other-user' });

      await expect(
        service.deleteAccount('user-id-1', requestUser),
      ).rejects.toThrow(ForbiddenException);

      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('존재하지 않는 계정이면 NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.deleteAccount('user-id-1', makeAuthUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException 시 트랜잭션을 시작하지 않는다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.deleteAccount('user-id-1', makeAuthUser()),
      ).rejects.toThrow(NotFoundException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('트랜잭션 내부에서 오류 발생 시 예외가 전파된다', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      mockDataSource.transaction.mockRejectedValue(
        new Error('DB connection error'),
      );

      await expect(
        service.deleteAccount('user-id-1', makeAuthUser()),
      ).rejects.toThrow('DB connection error');
    });

    it('반환값은 void (undefined)', async () => {
      const user = makeUser();
      userRepo.findOne!.mockResolvedValue(user);

      const manager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(
        (cb: (m: typeof manager) => Promise<void>) => cb(manager),
      );

      const result = await service.deleteAccount('user-id-1', makeAuthUser());

      expect(result).toBeUndefined();
    });
  });
});
