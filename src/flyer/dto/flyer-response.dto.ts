import type {
  Flyer,
  FlyerProductItem,
  FlyerReviewItem,
  FlyerTemplateType,
} from '../entities/flyer.entity';

export class FlyerResponseDto {
  id: string;
  storeName: string;
  promotionTitle: string;
  badge: string;
  badgeColor: string;
  dateRange: string;
  highlight: string;
  bgColor: string;
  emoji: string;
  templateType: FlyerTemplateType;
  warningText: string | null;
  ownerQuote: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  storeAddress: string | null;
  storeId: string | null;
  storeRating: number | null;
  storeReviewCount: number | null;
  products: FlyerProductItem[] | null;
  reviews: FlyerReviewItem[] | null;
  isActive: boolean;
  ownerApplicationId: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(flyer: Flyer): FlyerResponseDto {
    const dto = new FlyerResponseDto();
    dto.id = flyer.id;
    dto.storeName = flyer.storeName;
    dto.promotionTitle = flyer.promotionTitle;
    dto.badge = flyer.badge;
    dto.badgeColor = flyer.badgeColor;
    dto.dateRange = flyer.dateRange;
    dto.highlight = flyer.highlight;
    dto.bgColor = flyer.bgColor;
    dto.emoji = flyer.emoji;
    dto.templateType = flyer.templateType;
    dto.warningText = flyer.warningText ?? null;
    dto.ownerQuote = flyer.ownerQuote ?? null;
    dto.ownerName = flyer.ownerName ?? null;
    dto.ownerRole = flyer.ownerRole ?? null;
    dto.storeAddress = flyer.storeAddress ?? null;
    dto.storeId = flyer.ownerApplication?.store?.id ?? null;
    dto.storeRating = flyer.storeRating ?? null;
    dto.storeReviewCount = flyer.storeReviewCount ?? null;
    dto.products = flyer.products ?? null;
    dto.reviews = flyer.reviews ?? null;
    dto.isActive = flyer.isActive;
    dto.ownerApplicationId = flyer.ownerApplication?.id ?? null;
    dto.createdAt = flyer.createdAt;
    dto.updatedAt = flyer.updatedAt;
    return dto;
  }
}
