import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';

// 주요 체인 브랜드의 한/영 표기 양방향 매핑.
// 공공데이터 등록자가 "지에스25" 또는 "GS25" 어느 쪽으로든 입력해도
// 사용자가 "GS" / "지에스" 어느 쪽으로 검색하든 모두 매칭되게 한다.
// key 와 values 모두 lowercase 로 둔다 (입력 키워드도 lowercase 화 비교).
const BRAND_ALIASES: Array<[string, string[]]> = [
  ['gs', ['지에스']],
  ['지에스', ['gs']],
  ['cu', ['씨유']],
  ['씨유', ['cu']],
  ['세븐일레븐', ['코리아세븐']],
  ['코리아세븐', ['세븐일레븐']],
  ['emart', ['이마트']],
  ['이마트', ['emart']],
  ['ministop', ['미니스톱']],
  ['미니스톱', ['ministop']],
  ['homeplus', ['홈플러스']],
  ['홈플러스', ['homeplus']],
  ['lottemart', ['롯데마트']],
  ['롯데마트', ['lottemart']],
  ['더프레시', ['thefresh']],
  ['thefresh', ['더프레시']],
];

const expandKeywordAliases = (keyword: string): string[] => {
  const lower = keyword.toLowerCase();
  const variants = new Set<string>([keyword]);
  for (const [match, replacements] of BRAND_ALIASES) {
    if (!lower.includes(match)) continue;
    for (const replacement of replacements) {
      // 원문 keyword 의 대소문자/공백 보존을 위해 lower 기반으로 치환만 수행.
      // ILIKE 는 case-insensitive 라 결과 동일.
      const replaced = lower.split(match).join(replacement);
      variants.add(replaced);
    }
  }
  return Array.from(variants);
};
import { Store } from './entities/store.entity';
import { StoreReview } from './entities/store-review.entity';
import { User } from '../user/entities/user.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreResponseDto } from './dto/store-response.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  NearbyStoreQueryDto,
  NearbyStoreResponseDto,
} from './dto/nearby-store.dto';
import { SearchNearbyStoreQueryDto } from './dto/search-nearby-store.dto';
import { CreateStoreReviewDto } from './dto/create-store-review.dto';
import { StoreReviewResponseDto } from './dto/store-review-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { DB_ERROR_CODES } from '../common/constants/db-error-codes';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,

    @InjectRepository(StoreReview)
    private readonly reviewRepository: Repository<StoreReview>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createStore: CreateStoreDto): Promise<StoreResponseDto> {
    const store = this.storeRepository.create(createStore);
    const saved = await this.storeRepository.save(store);
    return StoreResponseDto.from(saved);
  }

  async findAll(
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<StoreResponseDto>> {
    const { page, limit } = pagination;
    const [stores, total] = await this.storeRepository.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      stores.map((store) => StoreResponseDto.from(store)),
      total,
      page,
      limit,
    );
  }

  async searchByName(name: string): Promise<StoreResponseDto[]> {
    // LIKE 와일드카드 이스케이프 — %, _, \ 를 리터럴로 처리
    const escaped = name.replace(/[\\%_]/g, '\\$&');
    const stores = await this.storeRepository
      .createQueryBuilder('store')
      .where('LOWER(store.name) LIKE LOWER(:name) ESCAPE :escape', {
        name: `%${escaped}%`,
        escape: '\\',
      })
      .orderBy('store.name', 'ASC')
      .limit(10)
      .getMany();
    return stores.map((store) => StoreResponseDto.from(store));
  }

  async findByExternalPlaceId(
    externalPlaceId: string,
  ): Promise<StoreResponseDto> {
    const store = await this.storeRepository.findOne({
      where: { externalPlaceId },
    });
    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }
    return StoreResponseDto.from(store);
  }

  async findNearby(
    query: NearbyStoreQueryDto,
  ): Promise<NearbyStoreResponseDto[]> {
    const { lat, lng, radius, limit } = query;

    // Bounding box 사전 필터링: 인덱스 범위 스캔으로 후보군 축소
    const latDelta = radius / 111_000;
    const lngDelta = radius / (111_000 * Math.cos((lat * Math.PI) / 180));

    const stores = await this.storeRepository
      .createQueryBuilder('store')
      .select([
        'store.id',
        'store.name',
        'store.type',
        'store.latitude',
        'store.longitude',
        'store.address',
      ])
      .addSelect(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        ))`,
        'distance',
      )
      .where('store.latitude BETWEEN :minLat AND :maxLat', {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
      })
      .andWhere('store.longitude BETWEEN :minLng AND :maxLng', {
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
      })
      .andWhere(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        )) <= :radius`,
      )
      .setParameters({ lat, lng, radius })
      .orderBy('distance', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    // Create a map for O(1) lookup instead of O(n) find
    const storeMap = new Map(stores.entities.map((s) => [s.id, s]));

    return stores.raw
      .map((row: { distance: string; store_id: string }) => {
        const store = storeMap.get(row.store_id);
        if (!store) return null;
        const dto = new NearbyStoreResponseDto();
        dto.id = store.id;
        dto.name = store.name;
        dto.type = store.type;
        dto.latitude = store.latitude;
        dto.longitude = store.longitude;
        dto.address = store.address;
        dto.distance = Math.round(parseFloat(row.distance));
        return dto;
      })
      .filter((dto): dto is NearbyStoreResponseDto => dto !== null);
  }

  // 좌표 + 키워드 결합 검색.
  // - 사용자 위치를 중심으로 radius 안쪽에서 name ILIKE 매칭되는 매장을 거리순으로 반환.
  // - 외부 검색 API(Naver Local) 의 5건 한계/위치 미지원 문제를 자체 DB 로 해결한다.
  // - keyword 가 비어 있으면 단순 nearby 와 동일하게 동작한다.
  async searchNearby(
    query: SearchNearbyStoreQueryDto,
  ): Promise<NearbyStoreResponseDto[]> {
    const { lat, lng, radius, limit } = query;
    const keyword = query.keyword?.trim() ?? '';

    // Bounding box 사전 필터링: 인덱스 범위 스캔으로 후보군 축소
    const latDelta = radius / 111_000;
    const lngDelta = radius / (111_000 * Math.cos((lat * Math.PI) / 180));

    const qb = this.storeRepository
      .createQueryBuilder('store')
      .select([
        'store.id',
        'store.name',
        'store.type',
        'store.latitude',
        'store.longitude',
        'store.address',
      ])
      .addSelect(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        ))`,
        'distance',
      )
      .where('store.latitude BETWEEN :minLat AND :maxLat', {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
      })
      .andWhere('store.longitude BETWEEN :minLng AND :maxLng', {
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
      })
      .andWhere(
        `(6371000 * acos(
          cos(radians(:lat)) * cos(radians(store.latitude)) *
          cos(radians(store.longitude) - radians(:lng)) +
          sin(radians(:lat)) * sin(radians(store.latitude))
        )) <= :radius`,
      )
      .setParameters({ lat, lng, radius });

    if (keyword.length > 0) {
      // 사용자가 "GS"로 검색해도 공공데이터의 "지에스" 표기 매장을 매칭시키기 위해
      // 주요 체인의 한/영 표기를 양방향으로 확장한 ILIKE OR 조건을 만든다.
      //  - 입력 "Gs" → ILIKE '%Gs%' OR '%지에스%'
      //  - 입력 "씨유" → ILIKE '%씨유%' OR '%cu%'
      const variants = expandKeywordAliases(keyword);
      const escapedVariants = variants.map((v) => v.replace(/[\\%_]/g, '\\$&'));

      qb.andWhere(
        new Brackets((qb2) => {
          escapedVariants.forEach((esc, i) => {
            const param = `name${i}`;
            const pattern = `%${esc}%`;
            if (i === 0) {
              qb2.where(`store.name ILIKE :${param} ESCAPE :escape`, {
                [param]: pattern,
                escape: '\\',
              });
            } else {
              qb2.orWhere(`store.name ILIKE :${param} ESCAPE :escape`, {
                [param]: pattern,
              });
            }
          });
        }),
      );
    }

    const stores = await qb
      .orderBy('distance', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    const storeMap = new Map(stores.entities.map((s) => [s.id, s]));

    return stores.raw
      .map((row: { distance: string; store_id: string }) => {
        const store = storeMap.get(row.store_id);
        if (!store) return null;
        const dto = new NearbyStoreResponseDto();
        dto.id = store.id;
        dto.name = store.name;
        dto.type = store.type;
        dto.latitude = store.latitude;
        dto.longitude = store.longitude;
        dto.address = store.address;
        dto.distance = Math.round(parseFloat(row.distance));
        return dto;
      })
      .filter((dto): dto is NearbyStoreResponseDto => dto !== null);
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

  async addReview(
    storeId: string,
    userId: string,
    dto: CreateStoreReviewDto,
  ): Promise<StoreReviewResponseDto> {
    const [store, user] = await Promise.all([
      this.storeRepository.findOne({ where: { id: storeId } }),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);
    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }
    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    try {
      const review = this.reviewRepository.create({
        store,
        user,
        rating: dto.rating,
        comment: dto.comment ?? null,
      });
      const saved = await this.reviewRepository.save(review);
      return StoreReviewResponseDto.from(saved);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e as QueryFailedError & { code: string }).code ===
          DB_ERROR_CODES.UNIQUE_VIOLATION
      ) {
        throw new ConflictException('이미 리뷰를 작성했습니다.');
      }
      throw e;
    }
  }

  async findReviews(
    storeId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<StoreReviewResponseDto>> {
    const store = await this.storeRepository.findOne({
      where: { id: storeId },
    });
    if (!store) {
      throw new NotFoundException('존재하지 않는 매장입니다.');
    }

    const { page, limit } = pagination;
    const [reviews, total] = await this.reviewRepository.findAndCount({
      where: { store: { id: storeId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.of(
      reviews.map((r) => StoreReviewResponseDto.from(r)),
      total,
      page,
      limit,
    );
  }
}
