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
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    const getKey = (key: string): string => {
      return isProduction
        ? this.configService.getOrThrow<string>(key)
        : (this.configService.get<string>(key) ?? '');
    };

    this.mapClientId = getKey('NAVER_MAP_CLIENT_ID');
    this.mapClientSecret = getKey('NAVER_MAP_CLIENT_SECRET');
    this.searchClientId = getKey('NAVER_SEARCH_CLIENT_ID');
    this.searchClientSecret = getKey('NAVER_SEARCH_CLIENT_SECRET');
    this.kakaoRestApiKey = getKey('KAKAO_REST_API_KEY');
    this.vworldApiKey = getKey('VWORLD_API_KEY');
  }

  async geocode(query: string): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<{
        status?: string;
        meta?: { totalCount: number };
        addresses?: {
          roadAddress: string;
          jibunAddress: string;
          x: string;
          y: string;
        }[];
      }>('https://maps.apigw.ntruss.com/map-geocode/v2/geocode', {
        params: { query },
        headers: {
          'X-NCP-APIGW-API-KEY-ID': this.mapClientId,
          'X-NCP-APIGW-API-KEY': this.mapClientSecret,
        },
        timeout: 8000,
      });
      // Naver API가 결과를 반환하면 그대로 사용, 빈 응답이면 Vworld 폴백
      const addresses = res.data?.addresses;
      if (Array.isArray(addresses) && addresses.length > 0) {
        return res.data as Record<string, unknown>;
      }
      this.logger.warn('네이버 지오코딩 결과 없음, Vworld 폴백');
      return await this.geocodeVworldFallback(query);
    } catch (err) {
      this.logger.error(
        '네이버 지오코딩 API 호출 실패, Vworld 폴백',
        (err as AxiosError).message,
      );
      return await this.geocodeVworldFallback(query);
    }
  }

  // Vworld 주소 검색 — Naver Geocoding 폴백
  // 응답 형식을 Naver geocode 형식으로 변환하여 프론트 코드 변경 최소화
  private async geocodeVworldFallback(
    query: string,
  ): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get<{
        response?: {
          status?: string;
          result?: {
            items?: {
              address?: { road?: string; parcel?: string };
              point?: { x?: string; y?: string };
            }[];
          };
        };
      }>('https://api.vworld.kr/req/search', {
        params: {
          service: 'search',
          request: 'search',
          version: '2.0',
          crs: 'epsg:4326',
          size: 10,
          page: 1,
          query,
          type: 'address',
          category: 'road',
          format: 'json',
          key: this.vworldApiKey,
        },
        timeout: 8000,
      });

      const items = res.data?.response?.result?.items ?? [];
      const addresses = items
        .map((item) => {
          const road = item.address?.road ?? '';
          const parcel = item.address?.parcel ?? '';
          const x = item.point?.x ?? '';
          const y = item.point?.y ?? '';
          if (!x || !y) return null;

          // Vworld parcel은 "역삼동 839-5" 형태 — 도로명 앞부분(시/구)으로 접두어 보완
          const roadParts = road.split(' ');
          const guIdx = roadParts.findIndex(
            (p) => p.endsWith('구') || p.endsWith('군'),
          );
          const prefix =
            guIdx >= 0 ? roadParts.slice(0, guIdx + 1).join(' ') : '';
          const jibunAddress = prefix ? `${prefix} ${parcel}` : parcel;

          // 도로명에서 괄호 표기 제거 (예: "강남대로62길 34 (역삼동,...)")
          const roadAddress = road.replace(/\s*\(.*?\)\s*/g, '').trim();

          return { roadAddress, jibunAddress, x, y };
        })
        .filter(
          (
            addr,
          ): addr is {
            roadAddress: string;
            jibunAddress: string;
            x: string;
            y: string;
          } => addr !== null,
        );

      return {
        status: 'OK',
        meta: { totalCount: addresses.length },
        addresses,
      };
    } catch (err) {
      this.logger.error(
        'Vworld 지오코딩 폴백도 실패',
        (err as AxiosError).message,
      );
      throw new BadGatewayException('주소 검색 API 호출 실패');
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
