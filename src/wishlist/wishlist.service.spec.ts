import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { WishlistService } from './wishlist.service';
import { Wishlist } from './entities/wishlist.entity';
import { User } from '../user/entities/user.entity';
import { Product } from '../product/entities/product.entity';
import { ProductCategory, UnitType } from '../product/entities/product.entity';
import { CreateWishlistDto } from './dto/create-wishlist.dto';

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WISHLIST_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'test@example.com',
    nickname: 'tester',
    latitude: 37.5665,
    longitude: 126.978,
    trustScore: 0,
    oauths: [],
    prices: [],
    wishlists: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as User;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_ID,
    name: '사과',
    category: ProductCategory.FRUIT,
    unitType: UnitType.COUNT,
    prices: [],
    wishlists: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Product;
}

function makeWishlist(overrides: Partial<Wishlist> = {}): Wishlist {
  return {
    id: WISHLIST_ID,
    user: makeUser(),
    product: makeProduct(),
    createdAt: new Date('2024-01-01'),
    ...overrides,
  } as Wishlist;
}

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

function createMockQueryBuilder(getMany: jest.Mock) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getMany,
  };
  // 모든 체이닝 메서드가 자기 자신을 반환
  qb.innerJoin.mockReturnValue(qb);
  qb.leftJoinAndSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);
  return qb;
}

function createMockRepository<T extends object>(): MockRepository<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('WishlistService', () => {
  let service: WishlistService;
  let wishlistRepo: MockRepository<Wishlist>;
  let userRepo: MockRepository<User>;
  let productRepo: MockRepository<Product>;

  beforeEach(async () => {
    wishlistRepo = createMockRepository<Wishlist>();
    userRepo = createMockRepository<User>();
    productRepo = createMockRepository<Product>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        {
          provide: getRepositoryToken(Wishlist),
          useValue: wishlistRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productRepo,
        },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('add()', () => {
    let dto: CreateWishlistDto;

    beforeEach(() => {
      dto = { productId: PRODUCT_ID };
    });

    it('정상 등록: user, product 모두 존재하고 중복 없으면 저장한다', async () => {
      const user = makeUser();
      const product = makeProduct();
      const wishlist = makeWishlist({ user, product });

      userRepo.findOne!.mockResolvedValue(user);
      productRepo.findOne!.mockResolvedValue(product);
      wishlistRepo.create!.mockReturnValue(wishlist);
      wishlistRepo.save!.mockResolvedValue(wishlist);

      await expect(service.add(USER_ID, dto)).resolves.toBeUndefined();

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: USER_ID } });
      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
      });
      expect(wishlistRepo.create).toHaveBeenCalledWith({ user, product });
      expect(wishlistRepo.save).toHaveBeenCalledWith(wishlist);
    });

    it('user 없음: NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        '존재하지 않는 사용자입니다.',
      );

      expect(productRepo.findOne).not.toHaveBeenCalled();
      expect(wishlistRepo.save).not.toHaveBeenCalled();
    });

    it('product 없음: NotFoundException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());
      productRepo.findOne!.mockResolvedValue(null);

      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        '존재하지 않는 상품입니다.',
      );

      expect(wishlistRepo.save).not.toHaveBeenCalled();
    });

    it('이미 찜한 상품: DB unique 제약(23505) 위반 시 ConflictException을 던진다', async () => {
      userRepo.findOne!.mockResolvedValue(makeUser());
      productRepo.findOne!.mockResolvedValue(makeProduct());
      wishlistRepo.create!.mockReturnValue(makeWishlist());

      const uniqueError = new QueryFailedError('', [], new Error('')) as any;
      uniqueError.code = '23505';
      wishlistRepo.save!.mockRejectedValue(uniqueError);

      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.add(USER_ID, dto)).rejects.toThrow(
        '이미 찜한 상품입니다.',
      );
    });
  });

  describe('remove()', () => {
    it('정상 삭제: 찜 항목이 존재하면 remove를 호출한다', async () => {
      const wishlist = makeWishlist();
      wishlistRepo.findOne!.mockResolvedValue(wishlist);
      wishlistRepo.remove!.mockResolvedValue(undefined);

      await expect(
        service.remove(USER_ID, PRODUCT_ID),
      ).resolves.toBeUndefined();

      expect(wishlistRepo.findOne).toHaveBeenCalledWith({
        where: { user: { id: USER_ID }, product: { id: PRODUCT_ID } },
      });
      expect(wishlistRepo.remove).toHaveBeenCalledWith(wishlist);
    });

    it('찜 목록에 없음: NotFoundException을 던진다', async () => {
      wishlistRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove(USER_ID, PRODUCT_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(USER_ID, PRODUCT_ID)).rejects.toThrow(
        '찜 목록에 없는 상품입니다.',
      );

      expect(wishlistRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('findByUser()', () => {
    it('user ID가 없는 경우: 빈 찜목록을 반환한다 (JWT 인증된 userId는 항상 유효)', async () => {
      const getManyMock = jest.fn().mockResolvedValue([]);
      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('빈 찜목록: items가 빈 배열이고 totalCount가 0인 응답을 반환한다', async () => {
      const getManyMock = jest.fn().mockResolvedValue([]);
      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('정상 조회: QueryBuilder가 userId로 호출된다', async () => {
      const product = makeProduct({ prices: [] });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      await service.findByUser(USER_ID);

      expect(wishlistRepo.createQueryBuilder).toHaveBeenCalledWith('w');
      expect(getManyMock).toHaveBeenCalled();
    });

    it('정상 조회: 찜목록의 상품 정보와 totalCount가 올바르게 반환된다', async () => {
      const product = makeProduct({ prices: [] });
      const wishlist = makeWishlist({
        product,
        createdAt: new Date('2024-06-01'),
      });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);

      expect(result.totalCount).toBe(1);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.productId).toBe(PRODUCT_ID);
      expect(item.productName).toBe('사과');
      expect(item.category).toBe(ProductCategory.FRUIT);
      expect(item.unitType).toBe(UnitType.COUNT);
      expect(item.addedAt).toEqual(new Date('2024-06-01'));
    });

    it('최저가 선택: 여러 가격 중 가장 낮은 가격이 lowestPrice로 선택된다', async () => {
      const store1 = { id: 'store-1', name: '마트A' };
      const store2 = { id: 'store-2', name: '마트B' };
      const store3 = { id: 'store-3', name: '마트C' };

      const prices = [
        { id: 'price-1', price: 3000, store: store1 },
        { id: 'price-2', price: 1500, store: store2 },
        { id: 'price-3', price: 2500, store: store3 },
      ];

      const product = makeProduct({ prices: prices as any });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);
      const item = result.items[0];

      expect(item.lowestPrice).toBe(1500);
      expect(item.lowestPriceStoreName).toBe('마트B');
    });

    it('최저가 선택: 동일 최저가가 여러 개일 때 첫 번째 요소가 선택된다', async () => {
      const prices = [
        { id: 'price-1', price: 1000, store: { name: '마트A' } },
        { id: 'price-2', price: 1000, store: { name: '마트B' } },
      ];

      const product = makeProduct({ prices: prices as any });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);
      const item = result.items[0];

      expect(item.lowestPrice).toBe(1000);
      expect(item.lowestPriceStoreName).toBe('마트A');
    });

    it('prices가 없을 때: lowestPrice와 lowestPriceStoreName이 null이다', async () => {
      const product = makeProduct({ prices: [] });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);
      const item = result.items[0];

      expect(item.lowestPrice).toBeNull();
      expect(item.lowestPriceStoreName).toBeNull();
    });

    it('prices가 undefined일 때: lowestPrice와 lowestPriceStoreName이 null이다', async () => {
      const product = makeProduct({ prices: undefined as any });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);
      const item = result.items[0];

      expect(item.lowestPrice).toBeNull();
      expect(item.lowestPriceStoreName).toBeNull();
    });

    it('store가 null인 가격: lowestPriceStoreName이 null이다', async () => {
      const prices = [{ id: 'price-1', price: 2000, store: null }];

      const product = makeProduct({ prices: prices as any });
      const wishlist = makeWishlist({ product });
      const getManyMock = jest.fn().mockResolvedValue([wishlist]);

      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);
      const item = result.items[0];

      expect(item.lowestPrice).toBe(2000);
      expect(item.lowestPriceStoreName).toBeNull();
    });

    it('여러 찜 항목: 각 상품별 최저가가 개별적으로 계산된다', async () => {
      const productA = makeProduct({
        id: 'product-a',
        name: '사과',
        prices: [
          { id: 'p1', price: 5000, store: { name: '마트A' } },
          { id: 'p2', price: 3000, store: { name: '마트B' } },
        ] as any,
      });

      const productB = makeProduct({
        id: 'product-b',
        name: '배',
        prices: [{ id: 'p3', price: 8000, store: { name: '마트C' } }] as any,
      });

      const wishlistA = makeWishlist({ id: 'w-a', product: productA });
      const wishlistB = makeWishlist({ id: 'w-b', product: productB });

      const getManyMock = jest.fn().mockResolvedValue([wishlistA, wishlistB]);
      wishlistRepo.createQueryBuilder!.mockReturnValue(
        createMockQueryBuilder(getManyMock),
      );

      const result = await service.findByUser(USER_ID);

      expect(result.totalCount).toBe(2);
      expect(result.items[0].productName).toBe('사과');
      expect(result.items[0].lowestPrice).toBe(3000);
      expect(result.items[0].lowestPriceStoreName).toBe('마트B');
      expect(result.items[1].productName).toBe('배');
      expect(result.items[1].lowestPrice).toBe(8000);
      expect(result.items[1].lowestPriceStoreName).toBe('마트C');
    });
  });
});
