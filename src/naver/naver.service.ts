import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosError } from 'axios';

@Injectable()
export class NaverService {
  private readonly logger = new Logger(NaverService.name);
  private readonly mapClientId: string;
  private readonly mapClientSecret: string;
  private readonly searchClientId: string;
  private readonly searchClientSecret: string;
  private readonly kakaoRestApiKey: string;
  private readonly vworldApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.mapClientId = this.configService.getOrThrow<string>(
      'NAVER_MAP_CLIENT_ID',
    );
    this.mapClientSecret = this.configService.getOrThrow<string>(
      'NAVER_MAP_CLIENT_SECRET',
    );
    this.searchClientId = this.configService.getOrThrow<string>(
      'NAVER_SEARCH_CLIENT_ID',
    );
    this.searchClientSecret = this.configService.getOrThrow<string>(
      'NAVER_SEARCH_CLIENT_SECRET',
    );
    this.kakaoRestApiKey =
      this.configService.getOrThrow<string>('KAKAO_REST_API_KEY');
    this.vworldApiKey = this.configService.getOrThrow<string>('VWORLD_API_KEY');
  }

  async geocode(query: string): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<Record<string, unknown>>(
        'https://maps.apigw.ntruss.com/map-geocode/v2/geocode',
        {
          params: { query },
          headers: {
            'X-NCP-APIGW-API-KEY-ID': this.mapClientId,
            'X-NCP-APIGW-API-KEY': this.mapClientSecret,
          },
          timeout: 8000,
        },
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        '네이버 지오코딩 API 호출 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('네이버 지오코딩 API 호출 실패');
    }
  }

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<Record<string, unknown>>(
        'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc',
        {
          params: {
            coords: `${lng},${lat}`,
            output: 'json',
            orders: 'admcode',
          },
          headers: {
            'X-NCP-APIGW-API-KEY-ID': this.mapClientId,
            'X-NCP-APIGW-API-KEY': this.mapClientSecret,
          },
          timeout: 8000,
        },
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        '네이버 역지오코딩 API 호출 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('네이버 역지오코딩 API 호출 실패');
    }
  }

  async search(
    query: string,
    display = 10,
    sort = 'random',
  ): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<Record<string, unknown>>(
        'https://openapi.naver.com/v1/search/local.json',
        {
          params: { query, display, sort },
          headers: {
            'X-Naver-Client-Id': this.searchClientId,
            'X-Naver-Client-Secret': this.searchClientSecret,
          },
          timeout: 8000,
        },
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        '네이버 로컬 검색 API 호출 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('네이버 로컬 검색 API 호출 실패');
    }
  }

  async kakaoReverseGeocode(
    lat: number,
    lng: number,
  ): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<Record<string, unknown>>(
        'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json',
        {
          params: { x: lng, y: lat },
          headers: { Authorization: `KakaoAK ${this.kakaoRestApiKey}` },
          timeout: 8000,
        },
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        '카카오 역지오코딩 API 호출 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('카카오 역지오코딩 API 호출 실패');
    }
  }

  async vworldGeocode(
    lat: number,
    lng: number,
  ): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<Record<string, unknown>>(
        'https://api.vworld.kr/req/address',
        {
          params: {
            service: 'address',
            request: 'getAddress',
            version: '2.0',
            crs: 'epsg:4326',
            point: `${lng},${lat}`,
            format: 'json',
            type: 'PARCEL',
            zipcode: 'false',
            simple: 'false',
            key: this.vworldApiKey,
          },
          timeout: 8000,
        },
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        'Vworld 역지오코딩 API 호출 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('Vworld 역지오코딩 API 호출 실패');
    }
  }
}
