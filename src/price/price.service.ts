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
import { Product, UnitType } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PriceReactionService } from '../price-reaction/price-reaction.service';
import { NotificationService } from '../notification/notification.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { ProductPriceCardDto } from './dto/product-price-card.dto';
import { normalizeImageUrl } from '../common/utils/image-url.util';
import { PointService } from '../point/point.service';
import { RecentPriceQueryDto } from './dto/recent-price-query.dto';

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
    private readonly pointService: PointService,
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

    const { unitType, ...rest } = createPriceDto;
    const price = this.priceRepository.create({
      ...rest,
      unitType: unitType ?? UnitType.OTHER,
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

    this.pointService
      .rewardPriceCreate(user.id, saved.id, store.latitude, store.longitude)
      .catch((err: unknown) =>
        this.logger.warn('등록 포인트 적립 실패', (err as Error)?.message),
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

    const pairs = wishlists
      .filter(
        (w) =>
          w.user?.id &&
          w.user.id !== registeredByUserId &&
          w.user?.notifPriceChange,
      )
      .map((w) => ({
        userId: w.user.id,
        fcmToken: w.user.fcmToken ?? null,
      }));

    if (pairs.length === 0) return;

    const failedTokens = await this.notificationService.createAndPushMany(
      pairs,
      {
        type: 'wishlistLowered',
        title: '찜한 상품 새 가격',
        body: `"${productName}" 가격이 새로 등록됐어요: ${price.toLocaleString()}원`,
        linkType: 'product',
        linkId: productId,
      },
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
    query: RecentPriceQueryDto,
  ): Promise<PaginatedResponseDto<ProductPriceCardDto>> {
    const { page, limit } = query;
    const hasLocationFilter = this.hasLocationFilter(query);
    const distanceExpr = this.getDistanceSql('s');

    // 1. 고유 상품 수
    const countQuery = this.priceRepository
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.product_id)', 'cnt')
      .where('p.isActive = true');

    if (hasLocationFilter) {
      countQuery
        .innerJoin('p.store', 's')
        .andWhere('s.latitude IS NOT NULL')
        .andWhere('s.longitude IS NOT NULL')
        .andWhere(`${distanceExpr} <= :radiusM`, {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusM: query.radiusM,
        });
    }

    const countRow = await countQuery.getRawOne<{ cnt: string }>();
    const total = parseInt(countRow?.cnt ?? '0', 10);

    // 2. 상품별 최저가 row ID (DISTINCT ON)
    const cheapestRowsQuery = this.priceRepository
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .distinctOn(['p.product_id'])
      .where('p.isActive = true')
      .orderBy('p.product_id', 'ASC')
      .addOrderBy('p.price', 'ASC')
      .addOrderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (hasLocationFilter) {
      cheapestRowsQuery
        .innerJoin('p.store', 's')
        .andWhere('s.latitude IS NOT NULL')
        .andWhere('s.longitude IS NOT NULL')
        .andWhere(`${distanceExpr} <= :radiusM`, {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusM: query.radiusM,
        });
    }

    const cheapestRows = await cheapestRowsQuery.getRawMany<{ id: string }>();

    if (cheapestRows.length === 0) {
      return PaginatedResponseDto.of([], total, page, limit);
    }

    // 3. relations 로드
    const ids = cheapestRows.map((r) => r.id);
    const cheapestPrices = await this.priceRepository.find({
      where: ids.map((id) => ({ id })),
      relations: ['store', 'product', 'user'],
    });

    // 4. 상품별 집계 (maxPrice, avgPrice, storeCount)
    const productIds = cheapestPrices.map((p) => p.product.id);
    const aggregateQuery = this.priceRepository
      .createQueryBuilder('p')
      .select('p.product_id', 'productId')
      .addSelect('MAX(p.price)', 'maxPrice')
      .addSelect('AVG(p.price)', 'avgPrice')
      .addSelect('COUNT(DISTINCT p.store_id)', 'storeCount')
      .where('p.product_id IN (:...productIds)', { productIds })
      .andWhere('p.isActive = true')
      .groupBy('p.product_id');

    if (hasLocationFilter) {
      aggregateQuery
        .innerJoin('p.store', 's')
        .andWhere('s.latitude IS NOT NULL')
        .andWhere('s.longitude IS NOT NULL')
        .andWhere(`${distanceExpr} <= :radiusM`, {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusM: query.radiusM,
        });
    }

    const aggregates = await aggregateQuery.getRawMany<{
      productId: string;
      maxPrice: string;
      avgPrice: string;
      storeCount: string;
    }>();

    const aggMap = new Map(aggregates.map((a) => [a.productId, a]));

    // 4-1. 상품별 최근 7일 최저가 (isLowest7d 판정용)
    const lowest7dQuery = this.priceRepository
      .createQueryBuilder('p')
      .select('p.product_id', 'productId')
      .addSelect('MIN(p.price)', 'min7d')
      .where('p.product_id IN (:...productIds)', { productIds })
      .andWhere('p.isActive = true')
      .andWhere(`p."createdAt" >= NOW() - INTERVAL '7 days'`)
      .groupBy('p.product_id');

    if (hasLocationFilter) {
      lowest7dQuery
        .innerJoin('p.store', 's')
        .andWhere('s.latitude IS NOT NULL')
        .andWhere('s.longitude IS NOT NULL')
        .andWhere(`${distanceExpr} <= :radiusM`, {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusM: query.radiusM,
        });
    }

    const lowest7dRows = await lowest7dQuery.getRawMany<{
      productId: string;
      min7d: string;
    }>();
    const lowest7dMap = new Map(
      lowest7dRows.map((r) => [r.productId, parseFloat(r.min7d)]),
    );

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
      const minPrice = p.price;
      const maxPrice = parseFloat(agg?.maxPrice ?? String(p.price));
      const storeCount = parseInt(agg?.storeCount ?? '1', 10);
      const hasClosingDiscount =
        p.priceTagType === 'closing' ||
        (p.condition?.includes('마감') ?? false);
      const verificationCount = verCountMap.get(p.id) ?? 0;

      return {
        productId: p.product.id,
        productName: p.product.name,
        unitType: p.unitType ?? null,
        minPrice,
        maxPrice,
        storeCount,
        cheapestStore: p.store
          ? {
              id: p.store.id,
              name: p.store.name,
              latitude: p.store.latitude ?? null,
              longitude: p.store.longitude ?? null,
            }
          : null,
        imageUrl: normalizeImageUrl(p.imageUrl),
        quantity: p.quantity != null ? String(p.quantity) : null,
        hasClosingDiscount,
        verificationCount,
        createdAt: p.createdAt,
        registrant: p.user
          ? {
              nickname: p.user.nickname,
              profileImageUrl: p.user.profileImageUrl ?? null,
            }
          : null,
        priceTag: {
          type: p.priceTagType,
          originalPrice: p.originalPrice,
          bundleType: p.bundleType,
          bundleQty: p.bundleQty,
          flatGroupName: p.flatGroupName,
          memberPrice: p.memberPrice,
          endsAt: p.endsAt,
          cardLabel: p.cardLabel,
          cardDiscountType: p.cardDiscountType,
          cardDiscountValue: p.cardDiscountValue,
          cardConditionNote: p.cardConditionNote,
          note: p.note,
        },
        signals: {
          storeCount,
          minPrice,
          maxPrice,
          avgPrice:
            agg?.avgPrice != null ? Math.round(parseFloat(agg.avgPrice)) : null,
          isLowest7d:
            lowest7dMap.has(p.product.id) &&
            minPrice <= (lowest7dMap.get(p.product.id) ?? Infinity),
          hasClosingDiscount,
          verificationCount,
        },
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
      relations: ['user', 'store'],
    });
    if (!price) {
      throw new NotFoundException('가격 정보가 없습니다');
    }
    if (price.user?.id !== userId) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.priceRepository.remove(price);

    this.pointService
      .deductPriceDelete(
        userId,
        price.id,
        price.store.latitude,
        price.store.longitude,
      )
      .catch((err: unknown) =>
        this.logger.warn('삭제 포인트 차감 실패', (err as Error)?.message),
      );
  }

  private hasLocationFilter(
    query: RecentPriceQueryDto,
  ): query is RecentPriceQueryDto & {
    latitude: number;
    longitude: number;
    radiusM: number;
  } {
    return (
      query.latitude != null &&
      query.longitude != null &&
      query.radiusM != null &&
      Number.isFinite(query.latitude) &&
      Number.isFinite(query.longitude) &&
      Number.isFinite(query.radiusM)
    );
  }

  private getDistanceSql(storeAlias: string): string {
    return `6371000 * ACOS(LEAST(1, GREATEST(-1,
      COS(RADIANS(:latitude)) * COS(RADIANS(${storeAlias}.latitude)) * COS(RADIANS(${storeAlias}.longitude) - RADIANS(:longitude))
      + SIN(RADIANS(:latitude)) * SIN(RADIANS(${storeAlias}.latitude))
    )))`;
  }
}
