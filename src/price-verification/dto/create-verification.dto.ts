import {
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { VerificationResult } from '../entities/price-verification.entity';

export class CreateVerificationDto {
  @IsEnum(VerificationResult)
  result: VerificationResult;

  @ValidateIf(
    (o: { result: VerificationResult }) =>
      o.result === VerificationResult.DISPUTED,
  )
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(99999999)
  actualPrice?: number;
}
