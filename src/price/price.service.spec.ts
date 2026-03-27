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
  product.unitType = UnitType.COUNT;
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
    it('productId에 해당하는 Price 목록을 ASC 순으로 반환한다', async () => {
      const store = buildStore();
      const product = buildProduct();
      const prices = [
        buildPrice(store, product, { price: 900 }),
        buildPrice(store, product, {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          price: 1200,
        }),
      ];

      priceRepo.find.mockResolvedValue(prices);

      const result = await service.findByProduct(PRODUCT_UUID);

      expect(priceRepo.find).toHaveBeenCalledWith({
        where: { product: { id: PRODUCT_UUID }, isActive: true },
        relations: ['store', 'product', 'user'],
        order: { price: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(900);
      expect(result[1].price).toBe(1200);
    });

    it('해당 상품의 Price가 없으면 빈 배열을 반환한다', async () => {
      priceRepo.find.mockResolvedValue([]);

      const result = await service.findByProduct(INVALID_UUID);

      expect(result).toEqual([]);
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
});
