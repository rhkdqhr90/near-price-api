import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { Repository } from 'typeorm';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { UpdatePriceDto } from './dto/update-price.dto';

@Injectable()
export class PriceService {
  constructor(
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,

    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createPriceDto: CreatePriceDto): Promise<PriceResponseDto> {
    const store = await this.storeRepository.findOne({
      where: { id: createPriceDto.storeId },
    });

    const product = await this.productRepository.findOne({
      where: { id: createPriceDto.productId },
    });

    if (!store) {
      throw new NotFoundException('존재 하지 않는 매장입니다.');
    }

    if (!product) {
      throw new NotFoundException('존재 하지 않는 상품입니다.');
    }

    const price = this.priceRepository.create({
      ...createPriceDto,
      store,
      product,
    });
    const saved = await this.priceRepository.save(price);
    return PriceResponseDto.from(saved);
  }

  async findAll(): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      relations: ['store', 'product'],
    });
    return prices.map((price) => PriceResponseDto.from(price));
  }

  async findOne(id: string): Promise<PriceResponseDto> {
    const price = await this.priceRepository.findOne({
      where: { id },
      relations: ['store', 'product'],
    });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    return PriceResponseDto.from(price);
  }

  async findByProduct(productId: string): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      where: { product: { id: productId } },
      relations: ['store', 'product'],
      order: { price: 'ASC' },
    });
    return prices.map((price) => PriceResponseDto.from(price));
  }

  async update(
    id: string,
    updatePriceDto: UpdatePriceDto,
  ): Promise<PriceResponseDto> {
    const price = await this.priceRepository.findOne({ where: { id } });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    const update = { ...price, ...updatePriceDto };
    const saved = await this.priceRepository.save(update);
    return PriceResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const price = await this.priceRepository.findOne({ where: { id } });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    await this.priceRepository.remove(price);
  }
}
