import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyInquiryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  adminReply: string;
}
