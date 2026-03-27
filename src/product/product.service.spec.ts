import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ILike, Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { ProductService } from './product.service';
import { Product, ProductCategory, UnitType } from './entities/product.entity';
import { ProductSearchService } from './product-search.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { SearchProductResponseDto } from './dto/search-product.dto';

const PRODUCT_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INVALID_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

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

describe('ProductService', () => {
  let service: ProductService;
  let productRepo: jest.Mocked<Repository<Product>>;
  let productSearchService: jest.Mocked<ProductSearchService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ProductSearchService,
          useValue: {
            indexProduct: jest.fn(),
            searchProducts: jest.fn(),
            deleteProduct: jest.fn(),
            syncAllProducts: jest.fn(),
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

    service = module.get<ProductService>(ProductService);
    productRepo = module.get(getRepositoryToken(Product));
    productSearchService = module.get(ProductSearchService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('유효한 DTO로 Product를 생성하고 ProductResponseDto를 반환한다', async () => {
      const dto: CreateProductDto = {
        name: '신라면',
        category: ProductCategory.PROCESSED,
        unitType: UnitType.COUNT,
      };
      const productEntity = buildProduct();

      productRepo.create.mockReturnValue(productEntity);
      productRepo.save.mockResolvedValue(productEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(productRepo.create).toHaveBeenCalledWith(dto);
      expect(productRepo.save).toHaveBeenCalledWith(productEntity);
      expect(productSearchService.indexProduct).toHaveBeenCalledWith(
        productEntity,
      );
      expect(result).toBeInstanceOf(ProductResponseDto);
      expect(result.id).toBe(PRODUCT_UUID);
      expect(result.name).toBe('신라면');
      expect(result.category).toBe(ProductCategory.PROCESSED);
      expect(result.unitType).toBe(UnitType.COUNT);
    });

    it('저장 후 ElasticSearch 색인이 호출된다', async () => {
      const dto: CreateProductDto = {
        name: '진라면',
        category: ProductCategory.PROCESSED,
        unitType: UnitType.PACK,
      };
      const productEntity = buildProduct({ name: '진라면', unitType: UnitType.PACK });

      productRepo.create.mockReturnValue(productEntity);
      productRepo.save.mockResolvedValue(productEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      await service.create(dto);

      expect(productSearchService.indexProduct).toHaveBeenCalledTimes(1);
      expect(productSearchService.indexProduct).toHaveBeenCalledWith(
        productEntity,
      );
    });

    it('카테고리가 VEGETABLE인 상품도 정상 생성된다', async () => {
      const dto: CreateProductDto = {
        name: '당근',
        category: ProductCategory.VEGETABLE,
        unitType: UnitType.GRAM,
      };
      const productEntity = buildProduct({
        name: '당근',
        category: ProductCategory.VEGETABLE,
        unitType: UnitType.GRAM,
      });

      productRepo.create.mockReturnValue(productEntity);
      productRepo.save.mockResolvedValue(productEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result.category).toBe(ProductCategory.VEGETABLE);
      expect(result.unitType).toBe(UnitType.GRAM);
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('search 없이 호출하면 모든 Product를 name ASC로 반환한다', async () => {
      const products = [
        buildProduct({ id: PRODUCT_UUID, name: '신라면' }),
        buildProduct({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          name: '진라면',
        }),
      ];

      productRepo.find.mockResolvedValue(products);

      const result = await service.findAll();

      expect(productRepo.find).toHaveBeenCalledWith({
        where: undefined,
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(ProductResponseDto);
      expect(result[1]).toBeInstanceOf(ProductResponseDto);
    });

    it('search 파라미터가 있으면 ILike 필터가 적용된다', async () => {
      const products = [buildProduct({ name: '신라면' })];

      productRepo.find.mockResolvedValue(products);

      const result = await service.findAll('신라면');

      expect(productRepo.find).toHaveBeenCalledWith({
        where: { name: ILike('%신라면%') },
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('신라면');
    });

    it('빈 문자열 search는 undefined로 처리되어 전체 조회된다', async () => {
      productRepo.find.mockResolvedValue([]);

      await service.findAll('');

      expect(productRepo.find).toHaveBeenCalledWith({
        where: undefined,
        order: { name: 'ASC' },
      });
    });

    it('Product가 없으면 빈 배열을 반환한다', async () => {
      productRepo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────────
  describe('findOne()', () => {
    it('id가 존재하면 ProductResponseDto를 반환한다', async () => {
      const productEntity = buildProduct();

      productRepo.findOne.mockResolvedValue(productEntity);

      const result = await service.findOne(PRODUCT_UUID);

      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_UUID },
      });
      expect(result).toBeInstanceOf(ProductResponseDto);
      expect(result.id).toBe(PRODUCT_UUID);
      expect(result.name).toBe('신라면');
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(INVALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(INVALID_UUID)).rejects.toThrow(
        '존재하지 않는 상품입니다',
      );
    });
  });

  // ──────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('id가 존재하면 필드를 수정하고 ProductResponseDto를 반환한다', async () => {
      const productEntity = buildProduct();
      const dto: UpdateProductDto = { name: '신라면(매운맛)' };
      const updatedEntity = buildProduct({ name: '신라면(매운맛)' });

      productRepo.findOne.mockResolvedValue(productEntity);
      productRepo.save.mockResolvedValue(updatedEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      const result = await service.update(PRODUCT_UUID, dto);

      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_UUID },
      });
      expect(productRepo.save).toHaveBeenCalledWith({
        ...productEntity,
        ...dto,
      });
      expect(productSearchService.indexProduct).toHaveBeenCalledWith(
        updatedEntity,
      );
      expect(result).toBeInstanceOf(ProductResponseDto);
      expect(result.name).toBe('신라면(매운맛)');
    });

    it('category와 unitType도 함께 수정할 수 있다', async () => {
      const productEntity = buildProduct();
      const dto: UpdateProductDto = {
        category: ProductCategory.GRAIN,
        unitType: UnitType.KILOGRAM,
      };
      const updatedEntity = buildProduct({
        category: ProductCategory.GRAIN,
        unitType: UnitType.KILOGRAM,
      });

      productRepo.findOne.mockResolvedValue(productEntity);
      productRepo.save.mockResolvedValue(updatedEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      const result = await service.update(PRODUCT_UUID, dto);

      expect(result.category).toBe(ProductCategory.GRAIN);
      expect(result.unitType).toBe(UnitType.KILOGRAM);
    });

    it('수정 후 ElasticSearch 색인이 호출된다', async () => {
      const productEntity = buildProduct();
      const dto: UpdateProductDto = { name: '육개장 사발면' };
      const updatedEntity = buildProduct({ name: '육개장 사발면' });

      productRepo.findOne.mockResolvedValue(productEntity);
      productRepo.save.mockResolvedValue(updatedEntity);
      productSearchService.indexProduct.mockResolvedValue(undefined);

      await service.update(PRODUCT_UUID, dto);

      expect(productSearchService.indexProduct).toHaveBeenCalledTimes(1);
      expect(productSearchService.indexProduct).toHaveBeenCalledWith(
        updatedEntity,
      );
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(INVALID_UUID, { name: '변경' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(INVALID_UUID, { name: '변경' }),
      ).rejects.toThrow('존재하지 않는 상품입니다');
      expect(productRepo.save).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // remove()
  // ──────────────────────────────────────────────
  describe('remove()', () => {
    it('id가 존재하면 Product를 삭제하고 void를 반환한다', async () => {
      const productEntity = buildProduct();

      productRepo.findOne.mockResolvedValue(productEntity);
      productRepo.remove.mockResolvedValue(productEntity);
      productSearchService.deleteProduct.mockResolvedValue(undefined);

      const result = await service.remove(PRODUCT_UUID);

      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_UUID },
      });
      expect(productRepo.remove).toHaveBeenCalledWith(productEntity);
      expect(productSearchService.deleteProduct).toHaveBeenCalledWith(
        PRODUCT_UUID,
      );
      expect(result).toBeUndefined();
    });

    it('삭제 후 ElasticSearch에서도 제거된다', async () => {
      const productEntity = buildProduct();

      productRepo.findOne.mockResolvedValue(productEntity);
      productRepo.remove.mockResolvedValue(productEntity);
      productSearchService.deleteProduct.mockResolvedValue(undefined);

      await service.remove(PRODUCT_UUID);

      expect(productSearchService.deleteProduct).toHaveBeenCalledTimes(1);
      expect(productSearchService.deleteProduct).toHaveBeenCalledWith(
        PRODUCT_UUID,
      );
    });

    it('존재하지 않는 id이면 NotFoundException을 던진다', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(INVALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(INVALID_UUID)).rejects.toThrow(
        '존재하지 않는 상품입니다',
      );
      expect(productRepo.remove).not.toHaveBeenCalled();
      expect(productSearchService.deleteProduct).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // search()
  // ──────────────────────────────────────────────
  describe('search()', () => {
    it('키워드가 있으면 productSearchService.searchProducts를 호출하고 결과를 반환한다', async () => {
      const mockResults: SearchProductResponseDto[] = [
        { id: PRODUCT_UUID, name: '신라면', score: 1.5, highlight: ['<em>신라면</em>'] },
      ];

      productSearchService.searchProducts.mockResolvedValue(mockResults);

      const result = await service.search('신라면', 10);

      expect(productSearchService.searchProducts).toHaveBeenCalledWith(
        '신라면',
        10,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(PRODUCT_UUID);
    });

    it('키워드 앞뒤 공백을 trim한 뒤 검색한다', async () => {
      productSearchService.searchProducts.mockResolvedValue([]);

      await service.search('  신라면  ', 5);

      expect(productSearchService.searchProducts).toHaveBeenCalledWith(
        '신라면',
        5,
      );
    });

    it('keyword가 undefined이면 빈 배열을 반환하고 searchProducts를 호출하지 않는다', async () => {
      const result = await service.search(undefined, 10);

      expect(productSearchService.searchProducts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('keyword가 빈 문자열이면 빈 배열을 반환하고 searchProducts를 호출하지 않는다', async () => {
      const result = await service.search('', 10);

      expect(productSearchService.searchProducts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('keyword가 공백만 있으면 빈 배열을 반환하고 searchProducts를 호출하지 않는다', async () => {
      const result = await service.search('   ', 10);

      expect(productSearchService.searchProducts).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('limit이 없으면 undefined를 그대로 전달한다', async () => {
      productSearchService.searchProducts.mockResolvedValue([]);

      await service.search('신라면');

      expect(productSearchService.searchProducts).toHaveBeenCalledWith(
        '신라면',
        undefined,
      );
    });
  });

  // ──────────────────────────────────────────────
  // syncSearch()
  // ──────────────────────────────────────────────
  describe('syncSearch()', () => {
    it('syncAllProducts 결과를 { indexed: number } 형태로 반환한다', async () => {
      productSearchService.syncAllProducts.mockResolvedValue(42);

      const result = await service.syncSearch();

      expect(productSearchService.syncAllProducts).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ indexed: 42 });
    });

    it('색인된 상품이 없으면 { indexed: 0 }을 반환한다', async () => {
      productSearchService.syncAllProducts.mockResolvedValue(0);

      const result = await service.syncSearch();

      expect(result).toEqual({ indexed: 0 });
    });
  });

  // ──────────────────────────────────────────────
  // findPopularTags()
  // ──────────────────────────────────────────────
  describe('findPopularTags()', () => {
    it('기본 limit(6)으로 인기 상품명 배열을 반환한다', async () => {
      const rows = [
        { name: '신라면' },
        { name: '진라면' },
        { name: '당근' },
        { name: '사과' },
        { name: '삼겹살' },
        { name: '우유' },
      ];

      dataSource.query.mockResolvedValue(rows);

      const result = await service.findPopularTags();

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [6],
      );
      expect(result).toEqual(['신라면', '진라면', '당근', '사과', '삼겹살', '우유']);
    });

    it('limit을 커스텀 값으로 지정할 수 있다', async () => {
      const rows = [{ name: '신라면' }, { name: '당근' }, { name: '사과' }];

      dataSource.query.mockResolvedValue(rows);

      const result = await service.findPopularTags(3);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1'),
        [3],
      );
      expect(result).toHaveLength(3);
    });

    it('결과가 없으면 빈 배열을 반환한다', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await service.findPopularTags();

      expect(result).toEqual([]);
    });

    it('SQL 쿼리에 products와 prices JOIN이 포함된다', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.findPopularTags();

      const sql: string = dataSource.query.mock.calls[0][0] as string;
      expect(sql).toContain('products');
      expect(sql).toContain('prices');
      expect(sql).toContain('COUNT');
    });
  });
});
