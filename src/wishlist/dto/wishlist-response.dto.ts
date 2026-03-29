import {
  ProductCategory,
  UnitType,
} from '../../product/entities/product.entity';
import { Wishlist } from '../entities/wishlist.entity';

export class WishlistItemResponseDto {
  productId: string;
  productName: string;
  category: ProductCategory;
  unitType: UnitType;
  lowestPrice: number | null;
  lowestPriceStoreName: string | null;
  imageUrl: string | null;
  verificationCount: number;
  addedAt: Date;

  static from(wishlist: Wishlist): WishlistItemResponseDto {
    const dto = new WishlistItemResponseDto();
    dto.productId = wishlist.product.id;
    dto.productName = wishlist.product.name;
    dto.category = wishlist.product.category;
    dto.unitType = wishlist.product.unitType;
    dto.addedAt = wishlist.createdAt;

    const prices = wishlist.product.prices ?? [];
    if (prices.length === 0) {
      dto.lowestPrice = null;
      dto.lowestPriceStoreName = null;
      dto.imageUrl = null;
      dto.verificationCount = 0;
    } else {
      const lowest = prices.reduce((min, p) => (p.price < min.price ? p : min));
      const withImage = prices.find((p) => p.imageUrl) ?? null;
      dto.lowestPrice = lowest.price;
      dto.lowestPriceStoreName = lowest.store?.name ?? null;
      dto.imageUrl = withImage?.imageUrl ?? null;
      dto.verificationCount = lowest.verificationCount ?? 0;
    }

    return dto;
  }
}

export class WishlistResponseDto {
  items: WishlistItemResponseDto[];
  totalCount: number;

  static from(wishlists: Wishlist[]): WishlistResponseDto {
    const dto = new WishlistResponseDto();
    dto.items = wishlists.map((w) => WishlistItemResponseDto.from(w));
    dto.totalCount = wishlists.length;
    return dto;
  }
}
