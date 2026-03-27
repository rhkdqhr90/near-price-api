import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { AuthUser } from '../auth/types/auth-user.type';
import { containsBannedWords } from '../common/constants/banned-words';
import { Price } from '../price/entities/price.entity';
import { UserOauth } from './entities/user-oauth.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,
    @InjectRepository(UserOauth)
    private readonly userOauthRepository: Repository<UserOauth>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = this.userRepository.create(createUserDto);
    const saved = await this.userRepository.save(user);
    return UserResponseDto.from(saved);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { page, limit } = pagination;
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      users.map((user) => UserResponseDto.from(user)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return UserResponseDto.from(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requestUser: AuthUser,
  ): Promise<UserResponseDto> {
    if (requestUser.userId !== id && requestUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    const updatedUser = { ...user, ...updateUserDto };
    const saved = await this.userRepository.save(updatedUser);
    return UserResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    await this.userRepository.remove(user);
  }

  async checkNicknameAvailable(nickname: string): Promise<boolean> {
    const existing = await this.userRepository.findOne({
      where: { nickname },
    });
    return !existing;
  }

  async updateNickname(
    id: string,
    nickname: string,
    requestUser: AuthUser,
  ): Promise<UserResponseDto> {
    if (requestUser.userId !== id && requestUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    // 공백만으로 이루어진 닉네임 거부
    if (!nickname || nickname.trim().length === 0) {
      throw new BadRequestException(
        '닉네임은 공백으로만 이루어질 수 없습니다.',
      );
    }

    // 3일 제한: 마지막 변경 후 3일이 지나지 않았으면 거부
    if (user.nicknameChangedAt) {
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - new Date(user.nicknameChangedAt).getTime();
      if (elapsed < threeDaysMs) {
        const remainDays = Math.ceil(
          (threeDaysMs - elapsed) / (24 * 60 * 60 * 1000),
        );
        throw new BadRequestException(
          `닉네임은 3일에 한 번만 변경할 수 있습니다. (${remainDays}일 후 가능)`,
        );
      }
    }

    // 금칙어 필터링
    if (containsBannedWords(nickname)) {
      throw new BadRequestException('사용할 수 없는 닉네임입니다.');
    }

    // 변경하려는 닉네임과 현재 닉네임이 같으면 중복 확인 스킵
    if (user.nickname !== nickname) {
      const available = await this.checkNicknameAvailable(nickname);
      if (!available) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
    }

    user.nickname = nickname;
    user.nicknameChangedAt = new Date();
    const saved = await this.userRepository.save(user);
    return UserResponseDto.from(saved);
  }

  async updateFcmToken(id: string, fcmToken: string, requestUser: AuthUser) {
    if (requestUser.userId !== id) {
      throw new ForbiddenException('본인의 FCM 토큰만 변경할 수 있습니다.');
    }
    await this.userRepository.update(id, { fcmToken });
    return { success: true };
  }

  async updateNotificationSettings(
    id: string,
    dto: { notifPriceChange?: boolean; notifPromotion?: boolean },
    requestUser: AuthUser,
  ): Promise<{ success: boolean }> {
    if (requestUser.userId !== id) {
      throw new ForbiddenException('본인의 알림 설정만 변경할 수 있습니다.');
    }
    await this.userRepository.update(id, dto);
    return { success: true };
  }

  async deleteAccount(id: string, requestUser: AuthUser): Promise<void> {
    // 본인 계정만 삭제 가능
    if (requestUser.userId !== id) {
      throw new ForbiddenException('본인의 계정만 삭제할 수 있습니다.');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    await this.dataSource.transaction(async (manager) => {
      // 1. 유저가 등록한 가격 데이터의 user를 null로 설정 (익명화)
      await manager
        .createQueryBuilder()
        .update(Price)
        .set({ user: null })
        .where('user_id = :userId', { userId: id })
        .execute();

      // 2. 유저의 OAuth 데이터 삭제
      await manager.delete(UserOauth, { user: { id } });

      // 3. 유저의 개인정보 삭제 (email, nickname, profileImageUrl, fcmToken)
      // 하드 삭제로 처리 (트랜잭션 manager로 직접 삭제)
      await manager.delete(User, { id });
    });
  }
}
