# DTO 패턴

## 3개 DTO 필수 분리

모든 모듈은 create, update, response DTO를 분리한다.

### CreateDto

```typescript
import { IsString, IsNumber, IsUUID, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class Create<n>Dto {
  @IsUUID()
  storeId: string;

  @IsNumber()
  price: number;

  // 날짜는 반드시 @Type(() => Date) + @IsDate()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleEndDate?: Date;
}
```

### UpdateDto

수정 가능한 필드만 명시적으로 선언. FK(storeId, productId)는 변경 차단이 필요한 경우 제외.

```typescript
import { IsNumber, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class Update<n>Dto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleEndDate?: Date;
}
```

PartialType 사용 시 FK 변경이 허용되므로 주의. 의도적으로 허용하는 경우에만 PartialType 사용.

### ResponseDto

Entity를 직접 반환하지 않는다. 항상 ResponseDto를 통해 반환.

```typescript
export class <n>ResponseDto {
  id: string;
  price: number;
  storeName: string;
  createdAt: Date;

  static from(entity: <n>): <n>ResponseDto {
    const dto = new <n>ResponseDto();
    dto.id = entity.id;
    dto.price = entity.price;
    dto.storeName = entity.store?.name;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
```

## 금지사항

- 날짜 타입을 string으로 선언 금지 → Date + @Type(() => Date)
- Entity 직접 반환 금지
- DTO에 비즈니스 로직 금지 (from() 정적 메서드는 허용)
