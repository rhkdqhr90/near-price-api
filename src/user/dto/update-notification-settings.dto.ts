import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsBoolean()
  @IsOptional()
  notifPriceChange?: boolean;

  @IsBoolean()
  @IsOptional()
  notifPromotion?: boolean;
}
