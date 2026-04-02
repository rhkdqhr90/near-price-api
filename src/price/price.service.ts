import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { DataSource, Repository } from 'typeorm';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PriceReactionService } from '../price-reaction/price-reaction.service';
import { NotificationService } from '../notification/notification.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { ProductPriceCardDto } from './dto/product-price-card.dto';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  constructor(
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,

    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,

    private readonly priceReactionService: PriceReactionService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
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

    // 찜한 사용자들에게 알림 (비동기 fire-and-forget)
    this.notifyWishlistUsers(
      createPriceDto.productId,
      product.name,
      saved.price,
      userId,
    ).catch((err: unknown) =>
      this.logger.warn('찜 알림 전송 실패', (err as Error)?.message),
    );

    return PriceResponseDto.from(saved);
  }

  private async notifyWishlistUsers(
    productId: string,
    productName: string,
    price: number,
    registeredByUserId: string,
  ): Promise<void> {
    const wishlists = await this.wishlistRepository.find({
      where: { product: { id: productId } },
      relations: ['user'],
    });

    const tokens = wishlists
      .filter(
        (w) =>
          w.user?.id !== registeredByUserId &&
          w.user?.fcmToken != null &&
          w.user?.notifPriceChange,
      )
      .map((w) => w.user.fcmToken!);

    if (tokens.length === 0) return;

    const failedTokens = await this.notificationService.sendToMany(
      tokens,
      '찜한 상품 새 가격',
      `"${productName}" 가격이 새로 등록됐어요: ${price.toLocaleString()}원`,
    );

    // 만료/무효 토큰 정리
    if (failedTokens.length > 0) {
      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({ fcmToken: null })
        .where('fcm_token IN (:...tokens)', { tokens: failedTokens })
        .execute();
    }
  }

  async findRecent(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    const { page, limit } = pagination;
    const [prices, total] = await this.priceRepository.findAndCount({
      where: { isActive: true },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      prices.map((price) => PriceResponseDto.from(price)),
      total,
      page,
      limit,
    );
  }

  async findRecentByProduct(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ProductPriceCardDto>> {
    const { page, limit } = pagination;

    // 1. 고유 상품 수
    const countRow = await this.priceRepository
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.product_id)', 'cnt')
      .where('p.isActive = true')
      .getRawOne<{ cnt: string }>();
    const total = parseInt(countRow?.cnt ?? '0', 10);

    // 2. 상품별 최저가 row ID (DISTINCT ON)
    const cheapestRows = await this.dataSource.query<{ id: string }[]>(
      `SELECT DISTINCT ON (product_id) id
       FROM prices
       WHERE "isActive" = true
       ORDER BY product_id, price ASC, "createdAt" DESC
       LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    );

    if (cheapestRows.length === 0) {
      return PaginatedResponseDto.of([], total, page, limit);
    }

    // 3. relations 로드
    const ids = cheapestRows.map((r) => r.id);
    const cheapestPrices = await this.priceRepository.find({
      where: ids.map((id) => ({ id })),
      relations: ['store', 'product', 'user'],
    });

    // 4. 상품별 집계 (maxPrice, storeCount)
    const productIds = cheapestPrices.map((p) => p.product.id);
    const aggregates = await this.priceRepository
      .createQueryBuilder('p')
      .select('p.product_id', 'productId')
      .addSelect('MAX(p.price)', 'maxPrice')
      .addSelect('COUNT(DISTINCT p.store_id)', 'storeCount')
      .where('p.product_id IN (:...productIds)', { productIds })
      .andWhere('p.isActive = true')
      .groupBy('p.product_id')
      .getRawMany<{
        productId: string;
        maxPrice: string;
        storeCount: string;
      }>();

    const aggMap = new Map(aggregates.map((a) => [a.productId, a]));

    // 5. 가격별 맞아요(CONFIRM) 반응 수 집계
    const verCounts = await this.dataSource.query<
      { price_id: string; count: string }[]
    >(
      `SELECT price_id, COUNT(*) as count
       FROM price_reactions
       WHERE price_id = ANY($1) AND type = 'confirm'
       GROUP BY price_id`,
      [ids],
    );
    const verCountMap = new Map(
      verCounts.map((v) => [v.price_id, parseInt(v.count, 10)]),
    );

    // 6. 최신순 정렬 후 DTO 조립
    const sorted = cheapestPrices.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const data: ProductPriceCardDto[] = sorted.map((p) => {
      const agg = aggMap.get(p.product.id);
      return {
        productId: p.product.id,
        productName: p.product.name,
        unitType: p.product.unitType ?? null,
        minPrice: p.price,
        maxPrice: parseFloat(agg?.maxPrice ?? String(p.price)),
        storeCount: parseInt(agg?.storeCount ?? '1', 10),
        cheapestStore: p.store
          ? {
              id: p.store.id,
              name: p.store.name,
              latitude: p.store.latitude ?? null,
              longitude: p.store.longitude ?? null,
            }
          : null,
        imageUrl: p.imageUrl ?? null,
        quantity: p.quantity != null ? String(p.quantity) : null,
        hasClosingDiscount: p.condition?.includes('마감') ?? false,
        verificationCount: verCountMap.get(p.id) ?? 0,
        createdAt: p.createdAt,
        registrant: p.user
          ? {
              nickname: p.user.nickname,
              profileImageUrl: p.user.profileImageUrl ?? null,
            }
          : null,
      };
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    const { page, limit } = pagination;
    const [prices, total] = await this.priceRepository.findAndCount({
      where: { isActive: true },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      prices.map((price) => PriceResponseDto.from(price)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<PriceResponseDto> {
    const price = await this.priceRepository.findOne({
      where: { id },
      relations: ['store', 'product', 'user'],
    });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    return PriceResponseDto.from(price);
  }

  async findByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    const { page, limit } = pagination;
    const [prices, total] = await this.priceRepository.findAndCount({
      where: { user: { id: userId }, isActive: true },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      prices.map((price) => PriceResponseDto.from(price)),
      total,
      page,
      limit,
    );
  }

  async findByProduct(
    productId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    const { page, limit } = pagination;
    const [prices, total] = await this.priceRepository.findAndCount({
      where: { product: { id: productId }, isActive: true },
      relations: ['store', 'product', 'user'],
      order: { price: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      prices.map((price) => PriceResponseDto.from(price)),
      total,
      page,
      limit,
    );
  }

  async findByStore(
    storeId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }

    const { page, limit } = pagination;
    const [prices, total] = await this.priceRepository.findAndCount({
      where: { store: { id: storeId }, isActive: true },
      relations: ['store', 'product', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      prices.map((price) => PriceResponseDto.from(price)),
      total,
      page,
      limit,
    );
  }

  async findByProductName(productName: string): Promise<PriceResponseDto[]> {
    const trimmed = productName.trim();
    const prices = await this.priceRepository
      .createQueryBuilder('price')
      .leftJoinAndSelect('price.store', 'store')
      .leftJoinAndSelect('price.product', 'product')
      .leftJoinAndSelect('price.user', 'user')
      .where('LOWER(TRIM(product.name)) LIKE LOWER(:pattern) ESCAPE :escape', {
        pattern: `%${trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`,
        escape: '\\',
      })
      .andWhere('price.isActive = :isActive', { isActive: true })
      .orderBy('price.price', 'ASC')
      .getMany();
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
    Object.assign(price, updatePriceDto);
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
