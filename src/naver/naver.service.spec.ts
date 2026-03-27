import { BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { NaverService } from './naver.service';

describe('NaverService', () => {
  let service: NaverService;
  let axiosGetSpy: jest.SpyInstance;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        NAVER_MAP_CLIENT_ID: 'test-map-client-id',
        NAVER_MAP_CLIENT_SECRET: 'test-map-client-secret',
        NAVER_SEARCH_CLIENT_ID: 'test-search-client-id',
        NAVER_SEARCH_CLIENT_SECRET: 'test-search-client-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NaverService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NaverService>(NaverService);
    axiosGetSpy = jest.spyOn(axios, 'get');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('geocode', () => {
    const query = '서울특별시 강남구 테헤란로';
    const mockResponse = {
      status: '200',
      meta: { totalCount: 1, page: 1, count: 1 },
      addresses: [{ roadAddress: '서울특별시 강남구 테헤란로 1', x: '127.0', y: '37.0' }],
      errorMessage: '',
    };

    describe('성공 케이스', () => {
      it('geocode 쿼리를 받아 네이버 지오코딩 API 결과를 반환해야 한다', async () => {
        // Arrange
        axiosGetSpy.mockResolvedValueOnce({ data: mockResponse });

        // Act
        const result = await service.geocode(query);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(axiosGetSpy).toHaveBeenCalledTimes(1);
        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://maps.apigw.ntruss.com/map-geocode/v2/geocode',
          expect.objectContaining({
            params: { query },
            headers: {
              'X-NCP-APIGW-API-KEY-ID': 'test-map-client-id',
              'X-NCP-APIGW-API-KEY': 'test-map-client-secret',
            },
            timeout: 8000,
          }),
        );
      });
    });

    describe('실패 케이스', () => {
      it('axios 에러 발생 시 BadGatewayException을 던져야 한다', async () => {
        // Arrange
        const axiosError = new Error('Network Error');
        axiosGetSpy.mockRejectedValueOnce(axiosError);
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);

        // Act & Assert
        await expect(service.geocode(query)).rejects.toThrow(BadGatewayException);
        await expect(service.geocode(query)).rejects.toThrow(
          '네이버 지오코딩 API 호출 실패',
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          '네이버 지오코딩 API 호출 실패',
          axiosError.message,
        );
      });
    });
  });

  describe('reverseGeocode', () => {
    const lat = 37.4979;
    const lng = 127.0276;
    const mockResponse = {
      status: { code: 0, name: 'ok', message: 'done' },
      results: [
        {
          name: 'admcode',
          region: {
            area1: { name: '서울특별시' },
            area2: { name: '강남구' },
          },
        },
      ],
    };

    describe('성공 케이스', () => {
      it('위경도를 받아 네이버 역지오코딩 API 결과를 반환해야 한다', async () => {
        // Arrange
        axiosGetSpy.mockResolvedValueOnce({ data: mockResponse });

        // Act
        const result = await service.reverseGeocode(lat, lng);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(axiosGetSpy).toHaveBeenCalledTimes(1);
        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc',
          expect.objectContaining({
            params: {
              coords: `${lng},${lat}`,
              output: 'json',
              orders: 'admcode',
            },
            headers: {
              'X-NCP-APIGW-API-KEY-ID': 'test-map-client-id',
              'X-NCP-APIGW-API-KEY': 'test-map-client-secret',
            },
            timeout: 8000,
          }),
        );
      });
    });

    describe('실패 케이스', () => {
      it('axios 에러 발생 시 BadGatewayException을 던져야 한다', async () => {
        // Arrange
        const axiosError = new Error('Request Timeout');
        axiosGetSpy.mockRejectedValueOnce(axiosError);
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);

        // Act & Assert
        await expect(service.reverseGeocode(lat, lng)).rejects.toThrow(
          BadGatewayException,
        );
        await expect(service.reverseGeocode(lat, lng)).rejects.toThrow(
          '네이버 역지오코딩 API 호출 실패',
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          '네이버 역지오코딩 API 호출 실패',
          axiosError.message,
        );
      });
    });
  });

  describe('search', () => {
    const query = '강남 편의점';
    const mockResponse = {
      lastBuildDate: 'Thu, 27 Mar 2026 12:00:00 +0900',
      total: 100,
      start: 1,
      display: 10,
      items: [
        {
          title: 'GS25 강남점',
          link: '',
          category: '편의점',
          address: '서울특별시 강남구',
          roadAddress: '서울특별시 강남구 테헤란로 1',
          mapx: '1270000',
          mapy: '370000',
        },
      ],
    };

    describe('성공 케이스', () => {
      it('기본 파라미터(display=10, sort=random)로 검색 결과를 반환해야 한다', async () => {
        // Arrange
        axiosGetSpy.mockResolvedValueOnce({ data: mockResponse });

        // Act
        const result = await service.search(query);

        // Assert
        expect(result).toEqual(mockResponse);
        expect(axiosGetSpy).toHaveBeenCalledTimes(1);
        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://openapi.naver.com/v1/search/local.json',
          expect.objectContaining({
            params: { query, display: 10, sort: 'random' },
            headers: {
              'X-Naver-Client-Id': 'test-search-client-id',
              'X-Naver-Client-Secret': 'test-search-client-secret',
            },
            timeout: 8000,
          }),
        );
      });

      it('커스텀 display, sort 파라미터를 전달하면 해당 파라미터로 API를 호출해야 한다', async () => {
        // Arrange
        axiosGetSpy.mockResolvedValueOnce({ data: mockResponse });

        // Act
        const result = await service.search(query, 5, 'comment');

        // Assert
        expect(result).toEqual(mockResponse);
        expect(axiosGetSpy).toHaveBeenCalledWith(
          'https://openapi.naver.com/v1/search/local.json',
          expect.objectContaining({
            params: { query, display: 5, sort: 'comment' },
          }),
        );
      });
    });

    describe('실패 케이스', () => {
      it('axios 에러 발생 시 BadGatewayException을 던져야 한다', async () => {
        // Arrange
        const axiosError = new Error('Service Unavailable');
        axiosGetSpy.mockRejectedValueOnce(axiosError);
        const loggerErrorSpy = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);

        // Act & Assert
        await expect(service.search(query)).rejects.toThrow(BadGatewayException);
        await expect(service.search(query)).rejects.toThrow(
          '네이버 로컬 검색 API 호출 실패',
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          '네이버 로컬 검색 API 호출 실패',
          axiosError.message,
        );
      });
    });
  });
});
