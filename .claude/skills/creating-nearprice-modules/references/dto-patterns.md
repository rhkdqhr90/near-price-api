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

## 검증 데코레이터 전체 목록

```typescript
import { IsString, IsNumber, IsEmail, IsUUID, IsDate, IsInt,
         IsEnum, IsBoolean, IsOptional, IsArray, IsPositive,
         MinLength, MaxLength, Min, Max, Matches } from 'class-validator';

// 문자열
@IsString() name: string;
@Email() email: string;
@Length(2, 50) username: string;
@MaxLength(500) description: string;

// 숫자
@IsNumber() latitude: number;
@IsInt() quantity: number;
@IsPositive() price: number; // > 0

// UUID
@IsUUID() storeId: string;

// 날짜
@Type(() => Date)
@IsDate() saleEndDate: Date;

// Enum
@IsEnum(VerificationResult) result: VerificationResult;

// 선택 필드
@IsOptional() comment?: string;

// 배열
@IsArray() @IsUUID('all', { each: true }) productIds: string[];
```

## 신뢰도 시스템 DTO 예제 (NEW)

### CreateVerificationDto
```typescript
export class CreateVerificationDto {
  @IsEnum(VerificationResult)
  result: VerificationResult; // MATCH | DIFFERENT

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
```

### VerificationResponseDto
```typescript
export class VerificationResponseDto {
  id: string;
  priceId: string;
  userId: string;
  result: VerificationResult;
  comment?: string;
  createdAt: Date;

  static from(entity: PriceVerification): VerificationResponseDto {
    const dto = new VerificationResponseDto();
    dto.id = entity.id;
    dto.priceId = entity.priceId;
    dto.userId = entity.userId;
    dto.result = entity.result;
    dto.comment = entity.comment;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
```

### TrustScoreResponseDto
```typescript
export class TrustScoreResponseDto {
  userId: string;
  trustScore: number; // 0~100
  level: BadgeLevel; // BRONZE | SILVER | GOLD | PLATINUM
  totalVerifications: number;
  matchVerifications: number;
  matchRatio: number; // 0~100

  static from(entity: TrustScore): TrustScoreResponseDto {
    const dto = new TrustScoreResponseDto();
    dto.userId = entity.userId;
    dto.trustScore = entity.trustScore;
    dto.level = entity.level;
    dto.totalVerifications = entity.totalVerifications;
    dto.matchVerifications = entity.matchVerifications;
    dto.matchRatio = entity.totalVerifications > 0
      ? (entity.matchVerifications / entity.totalVerifications) * 100
      : 0;
    return dto;
  }
}
```

## 금지사항

- 날짜 타입을 string으로 선언 금지 → Date + @Type(() => Date)
- Entity 직접 반환 금지 → ResponseDto 필수
- DTO에 비즈니스 로직 금지 (from() 정적 메서드는 허용)
- Validation 데코레이터 누락 금지 → 모든 필드에 적용
- pk나 timestamps를 CreateDto에 포함 금지
