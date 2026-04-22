import { ProductResponseDto } from '../../product/dto/product-response.dto';
import { StoreResponseDto } from '../../store/dto/store-response.dto';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { UnitType } from '../../product/entities/product.entity';
import { Price } from '../entities/price.entity';
import { normalizeImageUrl } from '../../common/utils/image-url.util';

export class PriceResponseDto {
  id: string;
  user: UserResponseDto | null;
  store: StoreResponseDto;
  product: ProductResponseDto;
  price: number;
  quantity: number | null;
  unitType: UnitType;
  imageUrl: string;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
  condition: string | null;
  isActive: boolean;
  likeCount: number;
  reportCount: number;
  trustScore: number | null;
  verificationCount: number;
  confirmedCount: number;
  disputedCount: number;
  createdAt: Date;
  updatedAt: Date;

  static from(price: Price): PriceResponseDto {
    const dto = new PriceResponseDto();
    dto.id = price.id;
    dto.user = price.user ? UserResponseDto.from(price.user) : null;
    dto.store = StoreResponseDto.from(price.store);
    dto.product = ProductResponseDto.from(price.product);
    dto.price = price.price;
    dto.quantity = price.quantity;
    dto.unitType = price.unitType;
    dto.imageUrl = normalizeImageUrl(price.imageUrl) ?? price.imageUrl;
    dto.saleStartDate = price.saleStartDate;
    dto.saleEndDate = price.saleEndDate;
    dto.condition = price.condition;
    dto.isActive = price.isActive;
    dto.likeCount = price.likeCount;
    dto.reportCount = price.reportCount;
    dto.trustScore = price.trustScore;
    dto.verificationCount = price.verificationCount;
    dto.confirmedCount = price.confirmedCount;
    dto.disputedCount = price.disputedCount;
    dto.createdAt = price.createdAt;
    dto.updatedAt = price.updatedAt;
    return dto;
  }
}
