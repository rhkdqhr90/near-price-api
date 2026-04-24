import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectOwnerApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason: string;
}
