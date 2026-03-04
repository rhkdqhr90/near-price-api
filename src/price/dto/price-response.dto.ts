import { ProductResponseDto } from '../../product/dto/product-response.dto';
import { StoreResponseDto } from '../../store/dto/store-response.dto';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { Price } from '../entities/price.entity';

export class PriceResponseDto {
  id: string;
  user: UserResponseDto | null;
  store: StoreResponseDto;
  product: ProductResponseDto;
  price: number;
  quantity: number | null;
  imageUrl: string;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
  condition: string | null;
  likeCount: number;
  reportCount: number;
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
    dto.imageUrl = price.imageUrl;
    dto.saleStartDate = price.saleStartDate;
    dto.saleEndDate = price.saleEndDate;
    dto.condition = price.condition;
    dto.likeCount = price.likeCount;
    dto.reportCount = price.reportCount;
    dto.createdAt = price.createdAt;
    dto.updatedAt = price.updatedAt;
    return dto;
  }
}
