import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateOwnerApplicationDto {
  @IsUUID('4')
  storeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ownerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[0-9+\-()\s]{8,30}$/)
  ownerPhone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  businessRegistrationNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  proofImageUrl: string;
}
