export class ProductPriceCardDto {
  productId: string;
  productName: string;
  unitType: string | null;
  minPrice: number;
  maxPrice: number;
  storeCount: number;
  cheapestStore: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  imageUrl: string | null;
  quantity: string | null;
  hasClosingDiscount: boolean;
  verificationCount: number;
  createdAt: Date;
  registrant: { nickname: string; profileImageUrl: string | null } | null;
}
