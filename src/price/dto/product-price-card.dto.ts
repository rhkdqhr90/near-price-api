import type {
  BundleType,
  CardDiscountType,
  PriceTagType,
} from '../entities/price.entity';

/**
 * 가격표(PriceTag) 구조화 DTO.
 * 등록자가 지정한 가격표 타입 + 타입별 부가 필드를 묶어서 반환.
 * 앱에서는 이 객체만 보고 PriceTag/PriceCard 컴포넌트를 렌더링한다.
 */
export class PriceTagDto {
  type: PriceTagType;
  originalPrice: number | null;
  bundleType: BundleType | null;
  bundleQty: number | null;
  flatGroupName: string | null;
  memberPrice: number | null;
  endsAt: Date | null;
  cardLabel: string | null;
  cardDiscountType: CardDiscountType | null;
  cardDiscountValue: number | null;
  cardConditionNote: string | null;
  note: string | null;
}

/**
 * 시세 시그널(집계) DTO.
 * 상품 카드 우측 바/칩/뱃지 렌더링에 사용.
 */
export class PriceSignalsDto {
  storeCount: number;
  minPrice: number;
  maxPrice: number;
  // Step 5에서 채워짐. 없으면 null.
  avgPrice: number | null;
  // 최근 7일 내 최저가 여부.
  isLowest7d: boolean;
  // 마감할인 존재 여부 (기존 호환).
  hasClosingDiscount: boolean;
  // 해당 최저가 row의 CONFIRM 반응 수.
  verificationCount: number;
}

export class ProductPriceCardDto {
  productId: string;
  productName: string;
  unitType: string | null;

  // ── 기존 flat 필드 (하위 호환 유지) ──
  minPrice: number;
  maxPrice: number;
  storeCount: number;
  hasClosingDiscount: boolean;
  verificationCount: number;

  cheapestStore: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  imageUrl: string | null;
  quantity: string | null;
  createdAt: Date;
  registrant: { nickname: string; profileImageUrl: string | null } | null;

  // ── 신규 구조화 필드 ──
  priceTag: PriceTagDto;
  signals: PriceSignalsDto;
}
