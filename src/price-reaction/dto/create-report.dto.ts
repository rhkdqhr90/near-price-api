import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['가격 틀림', '매장 틀림', '허위 정보', '기타'])
  reason: string;
}
