import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StoreService } from './store.service';
import { Store, StoreType } from './entities/store.entity';
import { StoreReview } from './entities/store-review.entity';
import { User } from '../user/entities/user.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { NearbyStoreQueryDto } from './dto/nearby-store.dto';

const STORE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EXTERNAL_PLACE_ID = 'kakao-place-12345';

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: STORE_ID,
    name: '이마트 강남점',
    type: StoreType.LARGE_MART,
    latitude: 37.5665,
    longitude: 126.978,
    address: '서울 강남구 테헤란로 123',
    externalPlaceId: EXTERNAL_PLACE_ID,
    prices: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Store;
}

type MockRepository<T extends object> = Partial<
  Record<keyof Repository<T>, jest.Mock>
> & { createQueryBuilder: jest.Mock };

function createMockRepository<T extends object>(): MockRepository<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createQueryBuilderMock(result: unknown) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    setParameters: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawAndEntities: jest.fn(),
    getMany: jest.fn(),
  };

  // 체이닝을 위해 각 메서드가 qb 자신을 반환하도록 설정
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.setParameters.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.limit.mockReturnValue(qb);

  if ('raw' in (result as object)) {
    qb.getRawAndEntities.mockResolvedValue(result);
  } else {
    qb.getMany.mockResolvedValue(result);
  }

  return qb;
}

describe('StoreService', () => {
  let service: StoreService;
  let storeRepo: MockRepository<Store>;

  beforeEach(async () => {
    storeRepo = createMockRepository<Store>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: getRepositoryToken(Store),
          useValue: storeRepo,
        },
        {
          provide: getRepositoryToken(StoreReview),
          useValue: createMockRepository<StoreReview>(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository<User>(),
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────
  describe('create()', () => {
    it('정상 생성: create·save 호출 후 StoreResponseDto를 반환한다', async () => {
      const dto: CreateStoreDto = {
        name: '이마트 강남점',
        type: StoreType.LARGE_MART,
        latitude: 37.5665,
        longitude: 126.978,
        address: '서울 강남구 테헤란로 123',
        externalPlaceId: EXTERNAL_PLACE_ID,
      };
      const store = makeStore();

      storeRepo.create!.mockReturnValue(store);
      storeRepo.save!.mockResolvedValue(store);

      const result = await service.create(dto);

      expect(storeRepo.create).toHaveBeenCalledWith(dto);
      expect(storeRepo.save).toHaveBeenCalledWith(store);
      expect(result.id).toBe(STORE_ID);
      expect(result.name).toBe('이마트 강남점');
      expect(result.type).toBe(StoreType.LARGE_MART);
      expect(result.latitude).toBe(37.5665);
      expect(result.longitude).toBe(126.978);
      expect(result.address).toBe('서울 강남구 테헤란로 123');
      expect(result.externalPlaceId).toBe(EXTERNAL_PLACE_ID);
    });

    it('externalPlaceId 없이 생성: null로 저장된다', async () => {
      const dto: CreateStoreDto = {
        name: '동네 슈퍼',
        type: StoreType.SUPERMARKET,
        latitude: 37.5,
        longitude: 127.0,
        address: '서울 마포구 어딘가 1',
      };
      const store = makeStore({ externalPlaceId: null, name: '동네 슈퍼' });

      storeRepo.create!.mockReturnValue(store);
      storeRepo.save!.mockResolvedValue(store);

      const result = await service.create(dto);

      expect(result.externalPlaceId).toBeNull();
    });
  });

  // ──────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────
  describe('findAll()', () => {
    it('정상 조회: 전체 매장 목록을 PaginatedResponseDto로 반환한다', async () => {
      const stores = [
        makeStore({ id: 'id-1', name: '마트A' }),
        makeStore({ id: 'id-2', name: '마트B' }),
      ];
      storeRepo.findAndCount!.mockResolvedValue([stores, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(storeRepo.findAndCount).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.data[0].name).toBe('마트A');
    });

    it('매장이 없을 때: 빈 data를 반환한다', async () => {
      storeRepo.findAndCount!.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // searchByName()
  // ──────────────────────────────────────────
  describe('searchByName()', () => {
    it('정상 검색: 이름이 포함된 매장 목록을 반환한다', async () => {
      const stores = [
        makeStore({ id: 'id-1', name: '이마트 강남점' }),
        makeStore({ id: 'id-2', name: '이마트 서초점' }),
      ];
      const qb = createQueryBuilderMock(stores);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchByName('이마트');

      expect(storeRepo.createQueryBuilder).toHaveBeenCalledWith('store');
      expect(qb.where).toHaveBeenCalledWith(
        'LOWER(store.name) LIKE LOWER(:name) ESCAPE :escape',
        { name: '%이마트%', escape: '\\' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('store.name', 'ASC');
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('이마트 강남점');
    });

    it('검색 결과 없음: 빈 배열을 반환한다', async () => {
      const qb = createQueryBuilderMock([]);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchByName('존재하지않는매장');

      expect(result).toEqual([]);
    });

    it('검색어에 % 이스케이프 없이 LIKE 패턴을 구성한다', async () => {
      const qb = createQueryBuilderMock([]);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchByName('편의점');

      expect(qb.where).toHaveBeenCalledWith(
        'LOWER(store.name) LIKE LOWER(:name) ESCAPE :escape',
        { name: '%편의점%', escape: '\\' },
      );
    });
  });

  // ──────────────────────────────────────────
  // findByExternalPlaceId()
  // ──────────────────────────────────────────
  describe('findByExternalPlaceId()', () => {
    it('정상 조회: externalPlaceId로 매장을 찾아 반환한다', async () => {
      const store = makeStore();
      storeRepo.findOne!.mockResolvedValue(store);

      const result = await service.findByExternalPlaceId(EXTERNAL_PLACE_ID);

      expect(storeRepo.findOne).toHaveBeenCalledWith({
        where: { externalPlaceId: EXTERNAL_PLACE_ID },
      });
      expect(result.id).toBe(STORE_ID);
      expect(result.externalPlaceId).toBe(EXTERNAL_PLACE_ID);
    });

    it('매장 없음: NotFoundException을 던진다', async () => {
      storeRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.findByExternalPlaceId('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findByExternalPlaceId('nonexistent-id'),
      ).rejects.toThrow('존재하지 않는 매장입니다.');
    });
  });

  // ──────────────────────────────────────────
  // findNearby()
  // ──────────────────────────────────────────
  describe('findNearby()', () => {
    const query: NearbyStoreQueryDto = {
      lat: 37.5665,
      lng: 126.978,
      radius: 1000,
      limit: 50,
    };

    it('정상 조회: 반경 내 매장을 거리 순으로 반환한다', async () => {
      const store1 = makeStore({ id: 'store-1', name: '가까운마트' });
      const store2 = makeStore({ id: 'store-2', name: '먼마트' });

      const rawAndEntities = {
        raw: [
          { distance: '150.5', store_id: 'store-1' },
          { distance: '800.0', store_id: 'store-2' },
        ],
        entities: [store1, store2],
      };

      const qb = createQueryBuilderMock(rawAndEntities);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findNearby(query);

      expect(storeRepo.createQueryBuilder).toHaveBeenCalledWith('store');
      expect(qb.setParameters).toHaveBeenCalledWith({
        lat: 37.5665,
        lng: 126.978,
        radius: 1000,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('distance', 'ASC');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('가까운마트');
      expect(result[0].distance).toBe(151); // Math.round(150.5)
      expect(result[1].name).toBe('먼마트');
      expect(result[1].distance).toBe(800);
    });

    it('반경 내 매장 없음: 빈 배열을 반환한다', async () => {
      const rawAndEntities = { raw: [], entities: [] };
      const qb = createQueryBuilderMock(rawAndEntities);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findNearby(query);

      expect(result).toEqual([]);
    });

    it('raw에 있지만 entity가 없는 항목은 결과에서 제외된다', async () => {
      const store1 = makeStore({ id: 'store-1', name: '존재하는마트' });

      const rawAndEntities = {
        raw: [
          { distance: '100.0', store_id: 'store-1' },
          { distance: '200.0', store_id: 'store-orphan' }, // entity 없는 경우
        ],
        entities: [store1],
      };

      const qb = createQueryBuilderMock(rawAndEntities);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findNearby(query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('존재하는마트');
    });

    it('distance가 소수점을 포함할 때 Math.round로 반올림된다', async () => {
      const store = makeStore({ id: 'store-1' });
      const rawAndEntities = {
        raw: [{ distance: '499.9', store_id: 'store-1' }],
        entities: [store],
      };
      const qb = createQueryBuilderMock(rawAndEntities);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findNearby(query);

      expect(result[0].distance).toBe(500); // Math.round(499.9) = 500
    });

    it('NearbyStoreResponseDto 필드가 올바르게 매핑된다', async () => {
      const store = makeStore({
        id: 'store-1',
        name: '테스트마트',
        type: StoreType.MART,
        latitude: 37.5665,
        longitude: 126.978,
        address: '서울시 강남구',
      });
      const rawAndEntities = {
        raw: [{ distance: '300.0', store_id: 'store-1' }],
        entities: [store],
      };
      const qb = createQueryBuilderMock(rawAndEntities);
      storeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findNearby(query);

      expect(result[0].id).toBe('store-1');
      expect(result[0].name).toBe('테스트마트');
      expect(result[0].type).toBe(StoreType.MART);
      expect(result[0].latitude).toBe(37.5665);
      expect(result[0].longitude).toBe(126.978);
      expect(result[0].address).toBe('서울시 강남구');
      expect(result[0].distance).toBe(300);
    });
  });

  // ──────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────
  describe('findOne()', () => {
    it('정상 조회: id로 매장을 찾아 StoreResponseDto를 반환한다', async () => {
      const store = makeStore();
      storeRepo.findOne!.mockResolvedValue(store);

      const result = await service.findOne(STORE_ID);

      expect(storeRepo.findOne).toHaveBeenCalledWith({
        where: { id: STORE_ID },
      });
      expect(result.id).toBe(STORE_ID);
      expect(result.name).toBe('이마트 강남점');
    });

    it('매장 없음: NotFoundException을 던진다', async () => {
      storeRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        '존재 하지 않는 마켓 입니다',
      );
    });
  });

  // ──────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────
  describe('update()', () => {
    it('정상 수정: 기존 필드에 updateDto를 병합하여 저장한다', async () => {
      const store = makeStore();
      const updateDto: UpdateStoreDto = { name: '이마트 강남점 (신관)' };
      const updatedStore = makeStore({ name: '이마트 강남점 (신관)' });

      storeRepo.findOne!.mockResolvedValue(store);
      storeRepo.save!.mockResolvedValue(updatedStore);

      const result = await service.update(STORE_ID, updateDto);

      expect(storeRepo.findOne).toHaveBeenCalledWith({
        where: { id: STORE_ID },
      });
      expect(storeRepo.save).toHaveBeenCalledWith({
        ...store,
        ...updateDto,
      });
      expect(result.name).toBe('이마트 강남점 (신관)');
    });

    it('일부 필드만 수정: 나머지 필드는 기존 값이 유지된다', async () => {
      const store = makeStore();
      const updateDto: UpdateStoreDto = { address: '서울 강남구 새주소 456' };
      const updatedStore = makeStore({ address: '서울 강남구 새주소 456' });

      storeRepo.findOne!.mockResolvedValue(store);
      storeRepo.save!.mockResolvedValue(updatedStore);

      const result = await service.update(STORE_ID, updateDto);

      expect(storeRepo.save).toHaveBeenCalledWith({
        ...store,
        ...updateDto,
      });
      expect(result.address).toBe('서울 강남구 새주소 456');
      expect(result.name).toBe('이마트 강남점'); // 기존 값 유지
    });

    it('매장 없음: NotFoundException을 던진다', async () => {
      storeRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { name: '새이름' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('nonexistent-id', { name: '새이름' }),
      ).rejects.toThrow('존재 하지 않는 마켓 입니다');

      expect(storeRepo.save).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────
  // remove()
  // ──────────────────────────────────────────
  describe('remove()', () => {
    it('정상 삭제: 매장이 존재하면 remove를 호출하고 void를 반환한다', async () => {
      const store = makeStore();
      storeRepo.findOne!.mockResolvedValue(store);
      storeRepo.remove!.mockResolvedValue(undefined);

      await expect(service.remove(STORE_ID)).resolves.toBeUndefined();

      expect(storeRepo.findOne).toHaveBeenCalledWith({
        where: { id: STORE_ID },
      });
      expect(storeRepo.remove).toHaveBeenCalledWith(store);
    });

    it('매장 없음: NotFoundException을 던진다', async () => {
      storeRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        '존재 하지 않는 마켓 입니다',
      );

      expect(storeRepo.remove).not.toHaveBeenCalled();
    });
  });
});
