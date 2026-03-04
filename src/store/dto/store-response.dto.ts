import { Store, StoreType } from '../entities/store.entity';

export class StoreResponseDto {
  id: string;
  name: string;
  type: StoreType;
  latitude: number;
  longitude: number;
  address: string;
  kakaoPlaceId: string;
  createdAt: Date;
  updatedAt: Date;

  static from(store: Store): StoreResponseDto {
    const dto = new StoreResponseDto();
    dto.id = store.id;
    dto.name = store.name;
    dto.type = store.type;
    dto.latitude = store.latitude;
    dto.longitude = store.longitude;
    dto.address = store.address;
    dto.kakaoPlaceId = store.kakaoPlaceId;
    dto.createdAt = store.createdAt;
    dto.updatedAt = store.updatedAt;

    return dto;
  }
}
