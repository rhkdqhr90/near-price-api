import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../store/entities/store.entity';
import { User } from '../user/entities/user.entity';
import { CreateOwnerApplicationDto } from './dto/create-owner-application.dto';
import {
  OwnerApplicationAdminDetailDto,
  OwnerApplicationAdminListItemDto,
  OwnerApplicationResponseDto,
} from './dto/owner-application-response.dto';
import { RejectOwnerApplicationDto } from './dto/reject-owner-application.dto';
import { UpdateOwnerApplicationDto } from './dto/update-owner-application.dto';
import {
  OwnerApplication,
  OwnerApplicationStatus,
} from './entities/owner-application.entity';
import {
  decryptBusinessRegistrationNumber,
  encryptBusinessRegistrationNumber,
  maskBusinessRegistrationNumber,
  normalizeBusinessRegistrationNumber,
} from '../common/utils/business-registration.util';

@Injectable()
export class OwnerApplicationService {
  constructor(
    @InjectRepository(OwnerApplication)
    private readonly ownerApplicationRepository: Repository<OwnerApplication>,

    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createMyApplication(
    userId: string,
    dto: CreateOwnerApplicationDto,
  ): Promise<OwnerApplicationResponseDto> {
    const existing = await this.ownerApplicationRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('이미 사장 등록 신청이 존재합니다.');
    }

    const [user, store] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.storeRepository.findOne({ where: { id: dto.storeId } }),
    ]);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    if (!store) {
      throw new NotFoundException('매장을 찾을 수 없습니다.');
    }

    const normalized = normalizeBusinessRegistrationNumber(
      dto.businessRegistrationNumber,
    );
    if (!/^\d{10}$/.test(normalized)) {
      throw new BadRequestException('사업자등록번호 형식이 올바르지 않습니다.');
    }

    const entity = this.ownerApplicationRepository.create({
      user,
      store,
      ownerName: dto.ownerName,
      ownerPhone: dto.ownerPhone,
      businessRegistrationNumberEncrypted:
        encryptBusinessRegistrationNumber(normalized),
      businessRegistrationNumberMasked:
        maskBusinessRegistrationNumber(normalized),
      proofImageUrl: dto.proofImageUrl,
      status: OwnerApplicationStatus.PENDING,
      rejectionReason: null,
      reviewedAt: null,
      reviewedByAdmin: null,
    });

    const saved = await this.ownerApplicationRepository.save(entity);
    const reloaded = await this.findOneOrFail(saved.id);
    return OwnerApplicationResponseDto.from(reloaded);
  }

  async findMyApplication(
    userId: string,
  ): Promise<OwnerApplicationResponseDto> {
    const entity = await this.ownerApplicationRepository.findOne({
      where: { user: { id: userId } },
      relations: ['store'],
    });
    if (!entity) {
      throw new NotFoundException('사장 등록 신청이 없습니다.');
    }

    return OwnerApplicationResponseDto.from(entity);
  }

  async updateMyApplication(
    userId: string,
    dto: UpdateOwnerApplicationDto,
  ): Promise<OwnerApplicationResponseDto> {
    const entity = await this.ownerApplicationRepository.findOne({
      where: { user: { id: userId } },
      relations: ['store'],
    });
    if (!entity) {
      throw new NotFoundException('사장 등록 신청이 없습니다.');
    }

    if (dto.storeId) {
      const store = await this.storeRepository.findOne({
        where: { id: dto.storeId },
      });
      if (!store) {
        throw new NotFoundException('매장을 찾을 수 없습니다.');
      }
      entity.store = store;
    }

    if (dto.ownerName !== undefined) {
      entity.ownerName = dto.ownerName;
    }
    if (dto.ownerPhone !== undefined) {
      entity.ownerPhone = dto.ownerPhone;
    }
    if (dto.proofImageUrl !== undefined) {
      entity.proofImageUrl = dto.proofImageUrl;
    }

    if (dto.businessRegistrationNumber !== undefined) {
      const normalized = normalizeBusinessRegistrationNumber(
        dto.businessRegistrationNumber,
      );
      if (!/^\d{10}$/.test(normalized)) {
        throw new BadRequestException(
          '사업자등록번호 형식이 올바르지 않습니다.',
        );
      }
      entity.businessRegistrationNumberEncrypted =
        encryptBusinessRegistrationNumber(normalized);
      entity.businessRegistrationNumberMasked =
        maskBusinessRegistrationNumber(normalized);
    }

    // 수정 요청 시 재심사를 위해 상태 초기화
    entity.status = OwnerApplicationStatus.PENDING;
    entity.rejectionReason = null;
    entity.reviewedAt = null;
    entity.reviewedByAdmin = null;

    await this.ownerApplicationRepository.save(entity);
    const reloaded = await this.findOneOrFail(entity.id);
    return OwnerApplicationResponseDto.from(reloaded);
  }

  async removeMyApplication(userId: string): Promise<void> {
    const entity = await this.ownerApplicationRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!entity) {
      throw new NotFoundException('사장 등록 신청이 없습니다.');
    }

    await this.ownerApplicationRepository.remove(entity);
  }

  async findAllForAdmin(): Promise<OwnerApplicationAdminListItemDto[]> {
    const entities = await this.ownerApplicationRepository.find({
      relations: ['user', 'store'],
      order: { createdAt: 'DESC' },
    });

    return entities.map((entity) =>
      OwnerApplicationAdminListItemDto.from(entity),
    );
  }

  async findOneForAdmin(id: string): Promise<OwnerApplicationAdminDetailDto> {
    const entity = await this.findOneOrFail(id);
    const plain = decryptBusinessRegistrationNumber(
      entity.businessRegistrationNumberEncrypted,
    );
    return OwnerApplicationAdminDetailDto.from(entity, plain);
  }

  async approve(
    id: string,
    adminUserId: string,
  ): Promise<OwnerApplicationAdminListItemDto> {
    const [entity, admin] = await Promise.all([
      this.findOneOrFail(id),
      this.userRepository.findOne({ where: { id: adminUserId } }),
    ]);
    if (!admin) {
      throw new NotFoundException('관리자 정보를 찾을 수 없습니다.');
    }
    if (entity.status !== OwnerApplicationStatus.PENDING) {
      throw new BadRequestException(
        '심사중 상태의 신청만 승인 처리할 수 있습니다.',
      );
    }

    entity.status = OwnerApplicationStatus.APPROVED;
    entity.rejectionReason = null;
    entity.reviewedByAdmin = admin;
    entity.reviewedAt = new Date();

    const saved = await this.ownerApplicationRepository.save(entity);
    const reloaded = await this.findOneOrFail(saved.id);
    return OwnerApplicationAdminListItemDto.from(reloaded);
  }

  async reject(
    id: string,
    adminUserId: string,
    dto: RejectOwnerApplicationDto,
  ): Promise<OwnerApplicationAdminListItemDto> {
    const [entity, admin] = await Promise.all([
      this.findOneOrFail(id),
      this.userRepository.findOne({ where: { id: adminUserId } }),
    ]);
    if (!admin) {
      throw new NotFoundException('관리자 정보를 찾을 수 없습니다.');
    }
    if (entity.status !== OwnerApplicationStatus.PENDING) {
      throw new BadRequestException(
        '심사중 상태의 신청만 반려 처리할 수 있습니다.',
      );
    }

    entity.status = OwnerApplicationStatus.REJECTED;
    entity.rejectionReason = dto.rejectionReason.trim();
    entity.reviewedByAdmin = admin;
    entity.reviewedAt = new Date();

    const saved = await this.ownerApplicationRepository.save(entity);
    const reloaded = await this.findOneOrFail(saved.id);
    return OwnerApplicationAdminListItemDto.from(reloaded);
  }

  async findApprovedByUserId(userId: string): Promise<OwnerApplication> {
    const entity = await this.ownerApplicationRepository.findOne({
      where: {
        user: { id: userId },
        status: OwnerApplicationStatus.APPROVED,
      },
      relations: ['user', 'store'],
    });
    if (!entity) {
      throw new ForbiddenException('승인된 사장 계정만 접근할 수 있습니다.');
    }

    return entity;
  }

  private async findOneOrFail(id: string): Promise<OwnerApplication> {
    const entity = await this.ownerApplicationRepository.findOne({
      where: { id },
      relations: ['user', 'store', 'reviewedByAdmin'],
    });
    if (!entity) {
      throw new NotFoundException('사장 등록 신청을 찾을 수 없습니다.');
    }
    return entity;
  }
}
