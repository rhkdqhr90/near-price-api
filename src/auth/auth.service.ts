import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import axios from 'axios';
import { User, UserRole } from '../user/entities/user.entity';
import { UserOauth, OAuthProvider } from '../user/entities/user-oauth.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RedisService } from '../redis/redis.service';

const REFRESH_TOKEN_PREFIX = 'rt:';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7일

interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserOauth)
    private readonly userOauthRepository: Repository<UserOauth>,

    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async kakaoLogin(kakaoAccessToken: string): Promise<AuthResponseDto> {
    const kakaoUser = await this.getKakaoUserInfo(kakaoAccessToken);
    const user = await this.findOrCreateUser(kakaoUser);
    return await this.issueTokens(user);
  }

  async adminLogin(email: string, password: string): Promise<AuthResponseDto> {
    const adminEmail = this.configService.getOrThrow<string>('ADMIN_EMAIL');
    const adminPasswordHash = this.configService.getOrThrow<string>(
      'ADMIN_PASSWORD_HASH',
    );

    const emailBuf = Buffer.from(email);
    const adminEmailBuf = Buffer.from(adminEmail);
    const emailMatch =
      emailBuf.length === adminEmailBuf.length &&
      timingSafeEqual(emailBuf, adminEmailBuf);

    // ADMIN_PASSWORD_HASH format: "<salt>:<hex-hash>"
    const [salt, storedHash] = adminPasswordHash.split(':');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedKeyBuf = Buffer.from(storedHash, 'hex');
    const passwordMatch =
      derivedKey.length === storedKeyBuf.length &&
      timingSafeEqual(derivedKey, storedKeyBuf);

    if (!emailMatch || !passwordMatch) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const user = await this.userRepository.findOne({
      where: { email: adminEmail, role: UserRole.ADMIN },
    });
    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    return await this.issueTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        { secret: this.configService.getOrThrow('JWT_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('유효하지 않은 토큰 타입입니다.');
    }

    // Redis에 저장된 리프레시 토큰과 비교 (Redis 미설정 시 스킵)
    const storedToken = await this.redisService.get(
      `${REFRESH_TOKEN_PREFIX}${payload.sub}`,
    );
    if (storedToken !== null && storedToken !== dto.refreshToken) {
      throw new UnauthorizedException(
        '이미 사용되었거나 무효화된 리프레시 토큰입니다.',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    return await this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.redisService.del(`${REFRESH_TOKEN_PREFIX}${userId}`);
  }

  private async getKakaoUserInfo(
    kakaoAccessToken: string,
  ): Promise<KakaoUserInfo> {
    try {
      const { data } = await axios.get<KakaoUserInfo>(
        `${this.configService.getOrThrow<string>('KAKAO_API_URL')}/v2/user/me`,
        {
          headers: { Authorization: `Bearer ${kakaoAccessToken}` },
          timeout: 5000,
        },
      );
      return data;
    } catch {
      throw new UnauthorizedException('유효하지 않은 카카오 토큰입니다.');
    }
  }

  private async findOrCreateUser(kakaoUser: KakaoUserInfo): Promise<User> {
    const providerId = String(kakaoUser.id);

    const existing = await this.userOauthRepository.findOne({
      where: { provider: OAuthProvider.KAKAO, providerId },
      relations: ['user'],
    });

    if (existing) {
      // 기존 유저: 카카오 프로필 사진 업데이트 (변경됐을 수 있으므로)
      const newProfileImage =
        kakaoUser.kakao_account?.profile?.profile_image_url ??
        kakaoUser.kakao_account?.profile?.thumbnail_image_url ??
        null;
      if (
        newProfileImage &&
        existing.user.profileImageUrl !== newProfileImage
      ) {
        await this.userRepository.update(existing.user.id, {
          profileImageUrl: newProfileImage,
        });
        existing.user.profileImageUrl = newProfileImage;
      }
      return existing.user;
    }

    const email =
      kakaoUser.kakao_account?.email ?? `kakao_${providerId}@nearprice.app`;
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname ?? `사용자_${providerId}`;
    const profileImageUrl =
      kakaoUser.kakao_account?.profile?.profile_image_url ??
      kakaoUser.kakao_account?.profile?.thumbnail_image_url ??
      null;

    return await this.dataSource.transaction(async (em) => {
      const user = em.create(User, {
        email,
        nickname,
        profileImageUrl: profileImageUrl ?? null,
      });
      const savedUser = await em.save(user);

      const oauth = em.create(UserOauth, {
        user: savedUser,
        provider: OAuthProvider.KAKAO,
        providerId,
      });
      await em.save(oauth);

      return savedUser;
    });
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: this.configService.getOrThrow('JWT_EXPIRES_IN'),
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
    });

    // Redis에 리프레시 토큰 저장 (이전 토큰 자동 덮어쓰기 = rotation)
    await this.redisService.set(
      `${REFRESH_TOKEN_PREFIX}${user.id}`,
      refreshToken,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    const dto = new AuthResponseDto();
    dto.accessToken = accessToken;
    dto.refreshToken = refreshToken;
    dto.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      trustScore: user.trustScore,
      profileImageUrl: user.profileImageUrl ?? null,
    };
    return dto;
  }
}
