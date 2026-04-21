import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PriceService } from './price.service';
import { Price } from './entities/price.entity';
import { Store, StoreType } from '../store/entities/store.entity';
import {
  Product,
  ProductCategory,
  UnitType,
} from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { PriceReactionService } from '../price-reaction/price-reaction.service';
import { NotificationService } from '../notification/notification.service';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { DataSource } from 'typeorm';

const STORE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRICE_UUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_UUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const INVALID_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

function buildStore(overrides: Partial<Store> = {}): Store {
  const store = new Store();
  store.id = STORE_UUID;
  store.name = '이마트 강남점';
  store.type = StoreType.LARGE_MART;
  store.latitude = 37.4979;
  store.longitude = 127.0276;
  store.address = '서울 강남구 테헤란로 123';
  store.externalPlaceId = 'external-001';
  store.prices = [];
  store.createdAt = new Date('2025-01-01');
  store.updatedAt = new Date('2025-01-01');
  return Object.assign(store, overrides);
}

function buildProduct(overrides: Partial<Product> = {}): Product {
  const product = new Product();
  product.id = PRODUCT_UUID;
  product.name = '신라면';
  product.category = ProductCategory.PROCESSED;
  product.prices = [];
  product.createdAt = new Date('2025-01-01');
  product.updatedAt = new Date('2025-01-01');
  return Object.assign(product, overrides);
}

function buildUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = USER_UUID;
  user.email = 'test@example.com';
  user.nickname = '테스터';
  user.latitude = 37.4979;
  user.longitude = 127.0276;
  user.trustScore = 0;
  user.oauths = [];
  user.prices = [];
  user.createdAt = new Date('2025-01-01');
  user.updatedAt = new Date('2025-01-01');
  return Object.assign(user, overrides);
}

function buildPrice(
  store: Store,
  product: Product,
  overrides: Partial<Price> = {},
): Price {
  const price = new Price();
  price.id = PRICE_UUID;
  price.store = store;
  price.product = product;
  price.user = null as unknown as User;
  price.price = 1200;
  price.quantity = null;
  price.unitType = UnitType.COUNT;
  price.imageUrl = 'https://example.com/image.jpg';
  price.saleStartDate = null as unknown as Date;
  price.saleEndDate = null as unknown as Date;
  price.condition = null;
  price.likeCount = 0;
  price.reportCount = 0;
  price.createdAt = new Date('2025-01-01');
  price.updatedAt = new Date('2025-01-01');
  return Object.assign(price, overrides);
}

describe('PriceService', () => {
  let service: PriceService;
  let priceRepo: jest.Mocked<Repository<Price>>;
  let storeRepo: jest.Mocked<Repository<Store>>;
  let productRepo: jest.Mocked<Repository<Product>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceService,
        {
          provide: getRepositoryToken(Price),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Store),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wishlist),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: PriceReactionService,
          useValue: {
            recalculateTrustScore: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUser: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PriceService>(PriceService);
    priceRepo = module.get(getRepositoryToken(Price));
    storeRepo = module.get(getRepositoryToken(Store));
    productRepo = module.get(getRepositoryToken(Product));
    userRepo = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('store와 product가 존재하면 Price를 생성하고 PriceResponseDto를 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const dto: CreatePriceDto = {
        storeId: STORE_UUID,
        productId: PRODUCT_UUID,
        price: 1200,
        imageUrl: 'https://example.com/image.jpg',
      };
      const priceEntity = buildPrice(store, product);

      const user = buildUser();
      storeRepo.findOne.mockResolvedValue(store);
      productRepo.findOne.mockResolvedValue(product);
      userRepo.findOne.mockResolvedValue(user);
      priceRepo.create.mockReturnValue(priceEntity);
      priceRepo.save.mockResolvedValue(priceEntity);

      const result = await service.create(dto, USER_UUID);

      expect(storeRepo.findOne).toHaveBeenCalledWith({
        where: { id: STORE_UUID },
      });
      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_UUID },
      });
      expect(priceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ store, product }),
      );
      expect(priceRepo.save).toHaveBeenCalledWith(priceEntity);
      expect(result).toBeInstanceOf(PriceResponseDto);
      expect(result.id).toBe(PRICE_UUID);
      expect(result.price).toBe(1200);
    });

    it('0원 가격도 정상적으로 생성된다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const dto: CreatePriceDto = {
        storeId: STORE_UUID,
        productId: PRODUCT_UUID,
        price: 0,
        imageUrl: 'https://example.com/image.jpg',
      };
      const priceEntity = buildPrice(store, product, { price: 0 });

      const user = buildUser();
      storeRepo.findOne.mockResolvedValue(store);
      productRepo.findOne.mockResolvedValue(product);
      userRepo.findOne.mockResolvedValue(user);
      priceRepo.create.mockReturnValue(priceEntity);
      priceRepo.save.mockResolvedValue(priceEntity);

      const result = await service.create(dto, USER_UUID);

      expect(result.price).toBe(0);
    });

    it('존재하지 않는 storeId이면 NotFoundException을 던진다', async () => {
      const dto: CreatePriceDto = {
        storeId: INVALID_UUID,
        productId: PRODUCT_UUID,
        price: 1200,
        imageUrl: 'https://example.com/image.jpg',
      };

      storeRepo.findOne.mockResolvedValue(null);
      productRepo.findOne.mockResolvedValue(buildProduct());
      userRepo.findOne.mockResolvedValue(buildUser());

      await expect(service.create(dto, USER_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, USER_UUID)).rejects.toThrow(
        '존재하지 않는 매장입니다.',
      );
      expect(priceRepo.save).not.toHaveBeenCalled();
    });

    it('존재하지 않는 productId이면 NotFoundException을 던진다', async () => {
      const dto: CreatePriceDto = {
        storeId: STORE_UUID,
        productId: INVALID_UUID,
        price: 1200,
        imageUrl: 'https://example.com/image.jpg',
      };

      storeRepo.findOne.mockResolvedValue(buildStore());
      productRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(buildUser());

      await expect(service.create(dto, USER_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, USER_UUID)).rejects.toThrow(
        '존재하지 않는 상품입니다.',
      );
      expect(priceRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('모든 Price 목록을 PaginatedResponseDto로 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const prices = [
        buildPrice(store, product, { id: PRICE_UUID, price: 1200 }),
        buildPrice(store, product, {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          price: 1500,
        }),
      ];

      priceRepo.findAndCount.mockResolvedValue([prices, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(priceRepo.findAndCount).toHaveBeenCalledWith({
        where: { isActive: true },
        relations: ['store', 'product', 'user'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data[0]).toBeInstanceOf(PriceResponseDto);
    });

    it('Price가 없으면 빈 data를 반환한다', async () => {
      priceRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne()', () => {
    it('id가 존재하면 PriceResponseDto를 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const priceEntity = buildPrice(store, product);

      priceRepo.findOne.mockResolvedValue(priceEntity);

      const result = await service.findOne(PRICE_UUID);

      expect(priceRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRICE_UUID },
        relations: ['store', 'product', 'user'],
      });
      expect(result).toBeInstanceOf(PriceResponseDto);
      expect(result.id).toBe(PRICE_UUID);
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      priceRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(INVALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(INVALID_UUID)).rejects.toThrow(
        '가격 정보가 없습니다',
      );
    });
  });

  describe('findByProduct()', () => {
    it('productId에 해당하는 Price 목록을 ASC 순으로 페이지네이션하여 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const prices = [
        buildPrice(store, product, { price: 900 }),
        buildPrice(store, product, {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          price: 1200,
        }),
      ];

      priceRepo.findAndCount.mockResolvedValue([prices, 2]);

      const pagination = { page: 1, limit: 20 };
      const result = await service.findByProduct(PRODUCT_UUID, pagination);

      expect(priceRepo.findAndCount).toHaveBeenCalledWith({
        where: { product: { id: PRODUCT_UUID }, isActive: true },
        relations: ['store', 'product', 'user'],
        order: { price: 'ASC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].price).toBe(900);
      expect(result.data[1].price).toBe(1200);
      expect(result.total).toBe(2);
    });

    it('해당 상품의 Price가 없으면 빈 data 배열을 반환한다', async () => {
      priceRepo.findAndCount.mockResolvedValue([[], 0]);

      const pagination = { page: 1, limit: 20 };
      const result = await service.findByProduct(INVALID_UUID, pagination);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('update()', () => {
    it('id가 존재하고 소유자이면 스칼라 필드만 반영하여 수정된 PriceResponseDto를 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, { user });
      const dto: UpdatePriceDto = {
        price: 1500,
        imageUrl: 'https://example.com/updated.jpg',
      };
      const updatedEntity = buildPrice(store, product, {
        user,
        price: 1500,
        imageUrl: 'https://example.com/updated.jpg',
      });

      priceRepo.findOne.mockResolvedValue(priceEntity);
      priceRepo.save.mockResolvedValue(updatedEntity);

      const result = await service.update(PRICE_UUID, dto, USER_UUID);

      expect(result.price).toBe(1500);
      expect(result.imageUrl).toBe('https://example.com/updated.jpg');
      expect(result).toBeInstanceOf(PriceResponseDto);
    });

    it('findOne 호출 시 relations에 store, product, user가 포함된다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, { user });
      const dto: UpdatePriceDto = { price: 2000 };

      priceRepo.findOne.mockResolvedValue(priceEntity);
      priceRepo.save.mockResolvedValue(
        buildPrice(store, product, { user, price: 2000 }),
      );

      await service.update(PRICE_UUID, dto, USER_UUID);

      expect(priceRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRICE_UUID },
        relations: ['store', 'product', 'user'],
      });
    });

    it('price 수정 시 store/product 관계 객체는 변경되지 않는다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, { user });
      const dto: UpdatePriceDto = { price: 2000 };

      priceRepo.findOne.mockResolvedValue(priceEntity);
      priceRepo.save.mockResolvedValue(
        buildPrice(store, product, { user, price: 2000 }),
      );

      await service.update(PRICE_UUID, dto, USER_UUID);

      const savedArg: Price = priceRepo.save.mock.calls[0][0] as Price;
      expect(savedArg.store).toEqual(store);
      expect(savedArg.product).toEqual(product);
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      priceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(INVALID_UUID, { price: 1000 }, USER_UUID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(INVALID_UUID, { price: 1000 }, USER_UUID),
      ).rejects.toThrow('가격 정보가 없습니다');
    });

    it('소유자가 아니면 ForbiddenException을 던진다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const otherUser = buildUser({ id: 'other-user-uuid' });
      const priceEntity = buildPrice(store, product, { user: otherUser });

      priceRepo.findOne.mockResolvedValue(priceEntity);

      await expect(
        service.update(PRICE_UUID, { price: 1000 }, USER_UUID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove()', () => {
    it('id가 존재하고 소유자이면 Price를 삭제하고 void를 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, { user });

      priceRepo.findOne.mockResolvedValue(priceEntity);
      priceRepo.remove.mockResolvedValue(priceEntity);

      const result = await service.remove(PRICE_UUID, USER_UUID);

      expect(priceRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRICE_UUID },
        relations: ['user'],
      });
      expect(priceRepo.remove).toHaveBeenCalledWith(priceEntity);
      expect(result).toBeUndefined();
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      priceRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(INVALID_UUID, USER_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(INVALID_UUID, USER_UUID)).rejects.toThrow(
        '가격 정보가 없습니다',
      );
      expect(priceRepo.remove).not.toHaveBeenCalled();
    });

    it('소유자가 아니면 ForbiddenException을 던진다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const otherUser = buildUser({ id: 'other-user-uuid' });
      const priceEntity = buildPrice(store, product, { user: otherUser });

      priceRepo.findOne.mockResolvedValue(priceEntity);

      await expect(service.remove(PRICE_UUID, USER_UUID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(priceRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ── findRecentByProduct() ─────────────────────────────────────────────────

  describe('findRecentByProduct()', () => {
    function makeQbMock(rawOne?: { cnt: string }) {
      return {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(rawOne ?? { cnt: '0' }),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
    }

    it('활성 가격이 없으면 빈 data 배열과 total 0을 반환한다', async () => {
      const qb1 = makeQbMock({ cnt: '0' });
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce(qb1);
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
    });

    it('cheapestRows가 없으면 빈 data와 total을 반환한다', async () => {
      const qb1 = makeQbMock({ cnt: '3' });
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce(qb1);
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(3);
    });

    it('cheapestRows가 있으면 ProductPriceCardDto 배열을 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, {
        user,
        price: 1000,
        createdAt: new Date('2025-06-01'),
        imageUrl: null as unknown as string,
        condition: null,
        quantity: null,
      });

      // 1st qb: COUNT DISTINCT (count query)
      const qb1 = makeQbMock({ cnt: '1' });
      // 2nd qb: aggregates (getRawMany)
      const qb2 = makeQbMock();
      qb2.getRawMany.mockResolvedValue([
        { productId: PRODUCT_UUID, maxPrice: '1500', storeCount: '2' },
      ]);

      (priceRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      (dataSource.query as jest.Mock).mockResolvedValue([{ id: PRICE_UUID }]);
      (priceRepo.find as jest.Mock).mockResolvedValue([priceEntity]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      const card = result.data[0];
      expect(card.productId).toBe(PRODUCT_UUID);
      expect(card.productName).toBe('신라면');
      expect(card.minPrice).toBe(1000);
      expect(card.maxPrice).toBe(1500);
      expect(card.storeCount).toBe(2);
      expect(card.cheapestStore).not.toBeNull();
      expect(card.cheapestStore?.id).toBe(STORE_UUID);
    });

    it('hasClosingDiscount는 condition에 "마감"이 포함될 때 true다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, {
        user,
        price: 800,
        condition: '마감 특가',
        imageUrl: null as unknown as string,
        quantity: null,
      });

      const qb1 = makeQbMock({ cnt: '1' });
      const qb2 = makeQbMock();
      qb2.getRawMany.mockResolvedValue([
        { productId: PRODUCT_UUID, maxPrice: '800', storeCount: '1' },
      ]);

      (priceRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);
      (dataSource.query as jest.Mock).mockResolvedValue([{ id: PRICE_UUID }]);
      (priceRepo.find as jest.Mock).mockResolvedValue([priceEntity]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data[0].hasClosingDiscount).toBe(true);
    });

    it('condition이 null이면 hasClosingDiscount는 false다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, {
        user,
        price: 800,
        condition: null,
        imageUrl: null as unknown as string,
        quantity: null,
      });

      const qb1 = makeQbMock({ cnt: '1' });
      const qb2 = makeQbMock();
      qb2.getRawMany.mockResolvedValue([
        { productId: PRODUCT_UUID, maxPrice: '800', storeCount: '1' },
      ]);

      (priceRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);
      (dataSource.query as jest.Mock).mockResolvedValue([{ id: PRICE_UUID }]);
      (priceRepo.find as jest.Mock).mockResolvedValue([priceEntity]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data[0].hasClosingDiscount).toBe(false);
    });

    it('page 2 요청 시 OFFSET이 limit만큼 증가한다', async () => {
      const qb1 = makeQbMock({ cnt: '20' });
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce(qb1);
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      await service.findRecentByProduct({ page: 2, limit: 10 });

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 10],
      );
    });

    it('cnt가 undefined이면 total을 0으로 처리한다', async () => {
      const qb1 = makeQbMock(undefined);
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValueOnce(qb1);
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.total).toBe(0);
    });

    it('aggregate 정보가 없으면 maxPrice는 minPrice, storeCount는 1이다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, {
        user,
        price: 1200,
        condition: null,
        imageUrl: null as unknown as string,
        quantity: null,
      });

      const qb1 = makeQbMock({ cnt: '1' });
      const qb2 = makeQbMock();
      qb2.getRawMany.mockResolvedValue([]); // no aggregate

      (priceRepo.createQueryBuilder as jest.Mock)
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);
      (dataSource.query as jest.Mock).mockResolvedValue([{ id: PRICE_UUID }]);
      (priceRepo.find as jest.Mock).mockResolvedValue([priceEntity]);

      const result = await service.findRecentByProduct({ page: 1, limit: 10 });

      expect(result.data[0].maxPrice).toBe(1200);
      expect(result.data[0].storeCount).toBe(1);
    });
  });

  // ── findByProductName() ───────────────────────────────────────────────────

  describe('findByProductName()', () => {
    function makeQbMockForName(prices: Price[]) {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(prices),
      };
    }

    it('검색어에 매칭되는 Price 목록을 PriceResponseDto 배열로 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const prices = [
        buildPrice(store, product, { user, price: 900 }),
        buildPrice(store, product, {
          user,
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          price: 1200,
        }),
      ];
      const qb = makeQbMockForName(prices);
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findByProductName('신라면');

      expect(priceRepo.createQueryBuilder).toHaveBeenCalledWith('price');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('price.store', 'store');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'price.product',
        'product',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('price.user', 'user');
      expect(qb.where).toHaveBeenCalledWith(
        'LOWER(TRIM(product.name)) LIKE LOWER(:pattern) ESCAPE :escape',
        { pattern: '%신라면%', escape: '\\' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('price.isActive = :isActive', {
        isActive: true,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('price.price', 'ASC');
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(PriceResponseDto);
    });

    it('매칭되는 가격이 없으면 빈 배열을 반환한다', async () => {
      const qb = makeQbMockForName([]);
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findByProductName('없는상품');

      expect(result).toEqual([]);
    });

    it('검색어의 앞뒤 공백을 trim하여 LIKE 패턴을 생성한다', async () => {
      const qb = makeQbMockForName([]);
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      await service.findByProductName('  신라면  ');

      expect(qb.where).toHaveBeenCalledWith(
        'LOWER(TRIM(product.name)) LIKE LOWER(:pattern) ESCAPE :escape',
        { pattern: '%신라면%', escape: '\\' },
      );
    });

    it('반환된 배열의 모든 항목이 PriceResponseDto 인스턴스다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const user = buildUser();
      const priceEntity = buildPrice(store, product, { user });
      const qb = makeQbMockForName([priceEntity]);
      (priceRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const result = await service.findByProductName('신라면');

      result.forEach((item) => expect(item).toBeInstanceOf(PriceResponseDto));
    });
  });
});
