import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  NearbyStoreQueryDto,
  NearbyStoreResponseDto,
} from './dto/nearby-store.dto';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async create(createStore: CreateStoreDto): Promise<StoreResponseDto> {
    const store = this.storeRepository.create(createStore);
    const saved = await this.storeRepository.save(store);
    return StoreResponseDto.from(saved);
  }

  async findAll(): Promise<StoreResponseDto[]> {
    const stores = await this.storeRepository.find();
    return stores.map((store) => StoreResponseDto.from(store));
  }

  async findByExternalPlaceId(
    externalPlaceId: string,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({
      where: { externalPlaceId },
    });
    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }
    return StoreResponseDto.from(store);
  }

  async findNearby(
    query: NearbyStoreQueryDto,
  ): Promise<NearbyStoreResponseDto[]> {
    const { lat, lng, radius } = query;
    const stores = await this.storeRepository
      .createQueryBuilder('store')
      .select([
        'store.id',
        'store.name',
        'store.type',
        'store.latitude',
        'store.longitude',
        'store.address',
      ])
      .addSelect(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        ))`,
        'distance',
      )
      .where(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        )) <= :radius`,
      )
      .setParameters({ lat, lng, radius })
      .orderBy('distance', 'ASC')
      .getRawAndEntities();

    // Create a map for O(1) lookup instead of O(n) find
    const storeMap = new Map(stores.entities.map((s) => [s.id, s]));

    return stores.raw
      .map((row: { distance: string; store_id: string }) => {
        const store = storeMap.get(row.store_id);
        if (!store) return null;
        const dto = new NearbyStoreResponseDto();
        dto.id = store.id;
        dto.name = store.name;
        dto.type = store.type;
        dto.latitude = store.latitude;
        dto.longitude = store.longitude;
        dto.address = store.address;
        dto.distance = Math.round(parseFloat(row.distance));
        return dto;
      })
      .filter((dto): dto is NearbyStoreResponseDto => dto !== null);
  }

  async findOne(id: string): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({ where: { id } });

    if (!store) {
      throw new NotFoundException('존재 하지 않는 마켓 입니다');
    }

    return StoreResponseDto.from(store);
  }

  async update(
    id: string,
    updateStoreDto: UpdateStoreDto,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException('존재 하지 않는 마켓 입니다');
    }
    const update = { ...store, ...updateStoreDto };
    const saved = await this.storeRepository.save(update);
    return StoreResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const store = await this.storeRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException('존재 하지 않는 마켓 입니다');
    }
    await this.storeRepository.remove(store);
  }
}
