import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

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
