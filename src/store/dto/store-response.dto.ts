import { Store } from '../entities/store.entity';

export class StoreResponseDto {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string;
  externalPlaceId: string | null;
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
    dto.externalPlaceId = store.externalPlaceId;
    dto.createdAt = store.createdAt;
    dto.updatedAt = store.updatedAt;

    return dto;
  }
}
