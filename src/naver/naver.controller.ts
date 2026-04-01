import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NaverService } from './naver.service';
import { NaverGeocodeQueryDto } from './dto/naver-geocode-query.dto';
import { NaverReverseGeocodeQueryDto } from './dto/naver-reverse-geocode-query.dto';
import { NaverSearchQueryDto } from './dto/naver-search-query.dto';
import { KakaoReverseGeocodeQueryDto } from './dto/kakao-reverse-geocode-query.dto';
import { VworldGeocodeQueryDto } from './dto/vworld-geocode-query.dto';

@Controller('naver')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class NaverController {
  constructor(private readonly naverService: NaverService) {}

  @Get('geocode')
  async geocode(
    @Query() query: NaverGeocodeQueryDto,
  ): Promise<Record<string, unknown>> {
    return await this.naverService.geocode(query.query);
  }

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query() query: NaverReverseGeocodeQueryDto,
  ): Promise<Record<string, unknown>> {
    return await this.naverService.reverseGeocode(query.lat, query.lng);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(
    @Query() query: NaverSearchQueryDto,
  ): Promise<Record<string, unknown>> {
    return await this.naverService.search(
      query.query,
      query.display,
      query.sort,
    );
  }

  // @deprecated App에서 직접 사용하지 않음
  @UseGuards(JwtAuthGuard)
  @Get('kakao-reverse-geocode')
  async kakaoReverseGeocode(
    @Query() query: KakaoReverseGeocodeQueryDto,
  ): Promise<Record<string, unknown>> {
    return await this.naverService.kakaoReverseGeocode(query.lat, query.lng);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vworld-geocode')
  async vworldGeocode(
    @Query() query: VworldGeocodeQueryDto,
  ): Promise<Record<string, unknown>> {
    return await this.naverService.vworldGeocode(query.lat, query.lng);
  }
}
