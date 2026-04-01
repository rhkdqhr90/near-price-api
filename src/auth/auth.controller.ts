import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from './types/auth-user.type';
import { AuthService } from './auth.service';
import { KakaoLoginDto } from './dto/kakao-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('kakao')
  @HttpCode(HttpStatus.OK)
  async kakaoLogin(@Body() dto: KakaoLoginDto): Promise<AuthResponseDto> {
    return await this.authService.kakaoLogin(dto.kakaoAccessToken);
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto): Promise<AuthResponseDto> {
    return await this.authService.adminLogin(dto.email, dto.password);
  }

  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return await this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.authService.logout(user.userId);
  }
}
