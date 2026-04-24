import type {
  OwnerApplication,
  OwnerApplicationStatus,
} from '../entities/owner-application.entity';

export class OwnerApplicationStoreDto {
  id: string;
  name: string;
  address: string;
}

export class OwnerApplicationResponseDto {
  id: string;
  store: OwnerApplicationStoreDto;
  ownerName: string;
  ownerPhone: string;
  businessRegistrationNumberMasked: string;
  proofImageUrl: string;
  status: OwnerApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  static from(entity: OwnerApplication): OwnerApplicationResponseDto {
    const dto = new OwnerApplicationResponseDto();
    dto.id = entity.id;
    dto.store = {
      id: entity.store.id,
      name: entity.store.name,
      address: entity.store.address,
    };
    dto.ownerName = entity.ownerName;
    dto.ownerPhone = entity.ownerPhone;
    dto.businessRegistrationNumberMasked =
      entity.businessRegistrationNumberMasked;
    dto.proofImageUrl = entity.proofImageUrl;
    dto.status = entity.status;
    dto.rejectionReason = entity.rejectionReason;
    dto.reviewedAt = entity.reviewedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class OwnerApplicationAdminListItemDto {
  id: string;
  store: OwnerApplicationStoreDto;
  ownerName: string;
  ownerPhone: string;
  businessRegistrationNumberMasked: string;
  proofImageUrl: string;
  status: OwnerApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    nickname: string;
  };

  static from(entity: OwnerApplication): OwnerApplicationAdminListItemDto {
    const dto = new OwnerApplicationAdminListItemDto();
    Object.assign(dto, OwnerApplicationResponseDto.from(entity));
    dto.user = {
      id: entity.user.id,
      email: entity.user.email,
      nickname: entity.user.nickname,
    };
    return dto;
  }
}

export class OwnerApplicationAdminDetailDto {
  id: string;
  store: OwnerApplicationStoreDto;
  ownerName: string;
  ownerPhone: string;
  businessRegistrationNumberMasked: string;
  proofImageUrl: string;
  status: OwnerApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    nickname: string;
  };
  businessRegistrationNumberPlain: string;

  static from(
    entity: OwnerApplication,
    businessRegistrationNumberPlain: string,
  ): OwnerApplicationAdminDetailDto {
    const dto = new OwnerApplicationAdminDetailDto();
    Object.assign(dto, OwnerApplicationAdminListItemDto.from(entity));
    dto.businessRegistrationNumberPlain = businessRegistrationNumberPlain;
    return dto;
  }
}
