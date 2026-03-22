import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { AuthUser } from '../auth/types/auth-user.type';
import { containsBannedWords } from '../common/constants/banned-words';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = this.userRepository.create(createUserDto);
    const saved = await this.userRepository.save(user);
    return UserResponseDto.from(saved);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({ take: 100 });
    return users.map((user) => UserResponseDto.from(user));
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
      throw new BadRequestException('닉네임은 공백으로만 이루어질 수 없습니다.');
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
}
