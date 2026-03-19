import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { Repository } from 'typeorm';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PriceReactionService } from '../price-reaction/price-reaction.service';

@Injectable()
export class PriceService {
  constructor(
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,

    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly priceReactionService: PriceReactionService,
  ) {}

  async create(
    createPriceDto: CreatePriceDto,
    userId: string,
  ): Promise<PriceResponseDto> {
    const [store, product, user] = await Promise.all([
      this.storeRepository.findOne({ where: { id: createPriceDto.storeId } }),
      this.productRepository.findOne({
        where: { id: createPriceDto.productId },
      }),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);

    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }
    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다.');
    }
    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const price = this.priceRepository.create({
      ...createPriceDto,
      store,
      product,
      user,
    });
    const saved = await this.priceRepository.save(price);
    return PriceResponseDto.from(saved);
  }

  async findRecent(limit = 20): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      where: { isActive: true },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return prices.map((price) => PriceResponseDto.from(price));
  }

  async findAll(): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      relations: ['store', 'product'],
      take: 100,
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

  async findByUser(userId: string): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      where: { user: { id: userId } },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
    });
    return prices.map((price) => PriceResponseDto.from(price));
  }

  async findByProduct(productId: string): Promise<PriceResponseDto[]> {
    const prices = await this.priceRepository.find({
      where: { product: { id: productId }, isActive: true },
      relations: ['store', 'product'],
      order: { price: 'ASC' },
    });
    return prices.map((price) => PriceResponseDto.from(price));
  }

  async update(
    id: string,
    updatePriceDto: UpdatePriceDto,
    userId: string,
  ): Promise<PriceResponseDto> {
    const price = await this.priceRepository.findOne({
      where: { id },
      relations: ['store', 'product', 'user'],
    });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    if (price.user?.id !== userId) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }
    const { storeId, productId, ...scalarFields } = updatePriceDto;
    void storeId;
    void productId;
    Object.assign(price, scalarFields);
    const saved = await this.priceRepository.save(price);
    return PriceResponseDto.from(saved);
  }

  async deactivate(id: string): Promise<void> {
    const price = await this.priceRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!price) throw new NotFoundException('가격 정보가 없습니다.');
    await this.priceRepository.update({ id }, { isActive: false });
    if (price.user?.id) {
      await this.priceReactionService.recalculateTrustScore(price.user.id);
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const price = await this.priceRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    if (price.user?.id !== userId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.priceRepository.remove(price);
  }
}
