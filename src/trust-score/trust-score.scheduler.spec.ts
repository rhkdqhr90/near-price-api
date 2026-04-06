import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TrustScoreScheduler } from './trust-score.scheduler';
import { TrustScoreService } from './trust-score.service';

// Logger 출력 억제
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

describe('TrustScoreScheduler', () => {
  let scheduler: TrustScoreScheduler;
  let trustScoreService: jest.Mocked<TrustScoreService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustScoreScheduler,
        {
          provide: TrustScoreService,
          useValue: {
            recalculateAll: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    scheduler = module.get(TrustScoreScheduler);
    trustScoreService = module.get(TrustScoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recalculateAll', () => {
    it('TrustScoreService.recalculateAll 에 위임한다', async () => {
      await scheduler.recalculateAll();

      expect(trustScoreService.recalculateAll).toHaveBeenCalledTimes(1);
    });

    it('내부 에러 발생 시 예외가 상위로 전파되지 않음', async () => {
      (trustScoreService.recalculateAll as jest.Mock).mockRejectedValue(
        new Error('DB connection error'),
      );

      await expect(scheduler.recalculateAll()).resolves.not.toThrow();
    });

    it('에러 발생 시 logger.error 호출', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      (trustScoreService.recalculateAll as jest.Mock).mockRejectedValue(
        new Error('unexpected error'),
      );

      await scheduler.recalculateAll();

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
