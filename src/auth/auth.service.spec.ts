import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import axios from 'axios';
import { AuthService } from './auth.service';
import { User, UserRole } from '../user/entities/user.entity';
import { UserOauth, OAuthProvider } from '../user/entities/user-oauth.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let userOauthRepository: jest.Mocked<Repository<UserOauth>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mockEmCreate: jest.Mock;
  let mockEmSave: jest.Mock;

  const mockUser: User = {
    id: 'user-uuid-1234',
    email: 'test@example.com',
    nickname: '테스트유저',
    profileImageUrl: null,
    fcmToken: null,
    notifPriceChange: true,
    notifPromotion: false,
    nicknameChangedAt: null,
    latitude: null as unknown as number,
    longitude: null as unknown as number,
    role: UserRole.USER,
    trustScore: 0,
    oauths: [],
    prices: [],
    wishlists: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockUserOauth: UserOauth = {
    id: 'oauth-uuid-5678',
    user: mockUser,
    provider: OAuthProvider.KAKAO,
    providerId: '12345',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserOauth),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn(),
            available: false,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    userOauthRepository = module.get(getRepositoryToken(UserOauth));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // DataSource transaction mock 설정
    mockEmCreate = jest.fn();
    mockEmSave = jest.fn();
    const dataSource = module.get<DataSource>(DataSource);
    (dataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (em: any) => Promise<any>) => {
        return cb({ create: mockEmCreate, save: mockEmSave });
      },
    );

    // 기본 ConfigService 동작
    configService.get.mockReturnValue('https://kapi.kakao.com');
    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'JWT_EXPIRES_IN') return '1h';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      if (key === 'KAKAO_API_URL') return 'https://kapi.kakao.com';
      throw new Error(`Config key not found: ${key}`);
    });

    // 기본 JwtService 동작
    jwtService.signAsync
      .mockResolvedValueOnce('mock-access-token')
      .mockResolvedValueOnce('mock-refresh-token');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('kakaoLogin()', () => {
    describe('기존 유저 (user_oauth 존재하는 경우)', () => {
      it('userOauthRepository에서 기존 레코드를 찾으면 accessToken과 refreshToken을 반환한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 12345,
            kakao_account: {
              email: 'test@example.com',
              profile: { nickname: '테스트유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(mockUserOauth);

        const result: AuthResponseDto =
          await service.kakaoLogin('valid-kakao-token');

        expect(result).toBeInstanceOf(AuthResponseDto);
        expect(result.accessToken).toBe('mock-access-token');
        expect(result.refreshToken).toBe('mock-refresh-token');
      });

      it('기존 유저의 경우 userRepository.save를 호출하지 않는다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 12345,
            kakao_account: {
              email: 'test@example.com',
              profile: { nickname: '테스트유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(mockUserOauth);

        await service.kakaoLogin('valid-kakao-token');

        expect(userRepository.save).not.toHaveBeenCalled();
        expect(userOauthRepository.save).not.toHaveBeenCalled();
      });

      it('기존 유저의 id와 email로 JWT payload를 생성한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 12345,
            kakao_account: {
              email: 'test@example.com',
              profile: { nickname: '테스트유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(mockUserOauth);

        await service.kakaoLogin('valid-kakao-token');

        expect(jwtService.signAsync).toHaveBeenCalledWith(
          { sub: mockUser.id, email: mockUser.email, type: 'access' },
          expect.objectContaining({ expiresIn: '1h' }),
        );
        expect(jwtService.signAsync).toHaveBeenCalledWith(
          { sub: mockUser.id, email: mockUser.email, type: 'refresh' },
          expect.objectContaining({ expiresIn: '7d' }),
        );
      });
    });

    describe('신규 유저 (user_oauth 없는 경우)', () => {
      it('user INSERT 후 user_oauth INSERT를 수행하고 토큰을 반환한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 99999,
            kakao_account: {
              email: 'newuser@example.com',
              profile: { nickname: '신규유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(null);

        const newUser: User = {
          ...mockUser,
          id: 'new-user-uuid',
          email: 'newuser@example.com',
          nickname: '신규유저',
        };
        // 트랜잭션 내부 em.create/save mock
        mockEmCreate
          .mockReturnValueOnce(newUser) // User create
          .mockReturnValueOnce({
            user: newUser,
            provider: OAuthProvider.KAKAO,
            providerId: '99999',
          }); // UserOauth create
        mockEmSave
          .mockResolvedValueOnce(newUser) // User save
          .mockResolvedValueOnce({}); // UserOauth save

        const result: AuthResponseDto = await service.kakaoLogin(
          'new-user-kakao-token',
        );

        expect(result).toBeInstanceOf(AuthResponseDto);
        expect(result.accessToken).toBe('mock-access-token');
        expect(result.refreshToken).toBe('mock-refresh-token');

        expect(mockEmCreate).toHaveBeenCalledWith(User, {
          email: 'newuser@example.com',
          nickname: '신규유저',
          profileImageUrl: null,
        });
        expect(mockEmSave).toHaveBeenCalledWith(newUser);
      });

      it('신규 유저의 id와 email로 JWT payload를 생성한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 99999,
            kakao_account: {
              email: 'newuser@example.com',
              profile: { nickname: '신규유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(null);

        const newUser: User = {
          ...mockUser,
          id: 'new-user-uuid',
          email: 'newuser@example.com',
          nickname: '신규유저',
        };
        mockEmCreate.mockReturnValueOnce(newUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(newUser).mockResolvedValueOnce({});

        await service.kakaoLogin('new-user-kakao-token');

        expect(jwtService.signAsync).toHaveBeenCalledWith(
          { sub: newUser.id, email: newUser.email, type: 'access' },
          expect.objectContaining({ expiresIn: '1h' }),
        );
      });
    });

    describe('카카오 API 실패', () => {
      it('axios.get이 실패하면 UnauthorizedException을 던진다', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network Error'));

        await expect(service.kakaoLogin('invalid-kakao-token')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('UnauthorizedException 메시지가 "유효하지 않은 카카오 토큰입니다."이다', async () => {
        mockedAxios.get.mockRejectedValue(new Error('401 Unauthorized'));

        await expect(service.kakaoLogin('invalid-kakao-token')).rejects.toThrow(
          '유효하지 않은 카카오 토큰입니다.',
        );
      });

      it('빈 문자열 토큰으로 카카오 API 호출 실패 시 UnauthorizedException을 던진다', async () => {
        mockedAxios.get.mockRejectedValue(new Error('401'));

        await expect(service.kakaoLogin('')).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('카카오 API 실패 시 userOauthRepository.findOne을 호출하지 않는다', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network Error'));

        await expect(service.kakaoLogin('bad-token')).rejects.toThrow(
          UnauthorizedException,
        );

        expect(userOauthRepository.findOne).not.toHaveBeenCalled();
      });
    });

    describe('카카오 계정에 email/nickname이 없는 경우 (fallback)', () => {
      it('email이 없으면 kakao_{id}@nearprice.app을 사용한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 77777,
            kakao_account: { profile: { nickname: '닉네임있음' } },
          },
        });
        userOauthRepository.findOne.mockResolvedValue(null);
        const createdUser: User = {
          ...mockUser,
          id: 'u1',
          email: 'kakao_77777@nearprice.app',
          nickname: '닉네임있음',
        };
        mockEmCreate.mockReturnValueOnce(createdUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(createdUser).mockResolvedValueOnce({});

        await service.kakaoLogin('token-no-email');

        expect(mockEmCreate).toHaveBeenCalledWith(
          User,
          expect.objectContaining({ email: 'kakao_77777@nearprice.app' }),
        );
      });

      it('nickname이 없으면 사용자_{id}를 사용한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 88888,
            kakao_account: { email: 'has-email@example.com' },
          },
        });
        userOauthRepository.findOne.mockResolvedValue(null);
        const createdUser: User = {
          ...mockUser,
          id: 'u2',
          email: 'has-email@example.com',
          nickname: '사용자_88888',
        };
        mockEmCreate.mockReturnValueOnce(createdUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(createdUser).mockResolvedValueOnce({});

        await service.kakaoLogin('token-no-nickname');

        expect(mockEmCreate).toHaveBeenCalledWith(
          User,
          expect.objectContaining({ nickname: '사용자_88888' }),
        );
      });

      it('kakao_account 자체가 없으면 email과 nickname 모두 fallback 값을 사용한다', async () => {
        mockedAxios.get.mockResolvedValue({ data: { id: 55555 } });
        userOauthRepository.findOne.mockResolvedValue(null);
        const createdUser: User = {
          ...mockUser,
          id: 'u3',
          email: 'kakao_55555@nearprice.app',
          nickname: '사용자_55555',
        };
        mockEmCreate.mockReturnValueOnce(createdUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(createdUser).mockResolvedValueOnce({});

        await service.kakaoLogin('token-no-kakao-account');

        expect(mockEmCreate).toHaveBeenCalledWith(User, {
          email: 'kakao_55555@nearprice.app',
          nickname: '사용자_55555',
          profileImageUrl: null,
        });
      });

      it('email과 nickname 모두 없어도 AccessToken과 RefreshToken을 정상 반환한다', async () => {
        mockedAxios.get.mockResolvedValue({ data: { id: 55555 } });
        userOauthRepository.findOne.mockResolvedValue(null);
        const createdUser: User = {
          ...mockUser,
          id: 'u4',
          email: 'kakao_55555@nearprice.app',
          nickname: '사용자_55555',
        };
        mockEmCreate.mockReturnValueOnce(createdUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(createdUser).mockResolvedValueOnce({});

        const result = await service.kakaoLogin('token-no-kakao-account');

        expect(result.accessToken).toBe('mock-access-token');
        expect(result.refreshToken).toBe('mock-refresh-token');
      });

      it('profile이 있지만 nickname만 undefined인 경우 사용자_{id}를 사용한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 66666,
            kakao_account: { email: 'partial@example.com', profile: {} },
          },
        });
        userOauthRepository.findOne.mockResolvedValue(null);
        const createdUser: User = {
          ...mockUser,
          id: 'u5',
          email: 'partial@example.com',
          nickname: '사용자_66666',
        };
        mockEmCreate.mockReturnValueOnce(createdUser).mockReturnValueOnce({});
        mockEmSave.mockResolvedValueOnce(createdUser).mockResolvedValueOnce({});

        await service.kakaoLogin('token-partial-profile');

        expect(mockEmCreate).toHaveBeenCalledWith(
          User,
          expect.objectContaining({ nickname: '사용자_66666' }),
        );
      });
    });

    describe('카카오 API Authorization 헤더 검증', () => {
      it('카카오 API 호출 시 Bearer 토큰을 헤더에 포함한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 12345,
            kakao_account: {
              email: 'test@example.com',
              profile: { nickname: '테스트유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(mockUserOauth);

        await service.kakaoLogin('my-kakao-token');

        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/v2/user/me'),
          expect.objectContaining({
            headers: { Authorization: 'Bearer my-kakao-token' },
          }),
        );
      });
    });

    describe('userOauthRepository 쿼리 조건 검증', () => {
      it('provider: KAKAO, providerId: kakaoId(string)로 findOne을 호출한다', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            id: 12345,
            kakao_account: {
              email: 'test@example.com',
              profile: { nickname: '테스트유저' },
            },
          },
        });

        userOauthRepository.findOne.mockResolvedValue(mockUserOauth);

        await service.kakaoLogin('valid-token');

        expect(userOauthRepository.findOne).toHaveBeenCalledWith({
          where: { provider: OAuthProvider.KAKAO, providerId: '12345' },
          relations: ['user'],
        });
      });
    });
  });
});
