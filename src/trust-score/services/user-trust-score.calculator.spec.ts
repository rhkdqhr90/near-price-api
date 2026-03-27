import { UserTrustScoreCalculator } from './user-trust-score.calculator';

describe('UserTrustScoreCalculator', () => {
  let calculator: UserTrustScoreCalculator;

  beforeEach(() => {
    calculator = new UserTrustScoreCalculator();
  });

  // ── calculateUserTrustScore ──────────────────────────────────────────────

  describe('calculateUserTrustScore', () => {
    it('활동 5건 미만이면 기본값 50 반환', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 90,
        verificationScore: 80,
        consistencyBonus: 0,
        totalRegistrations: 2,
        totalVerifications: 2,
        activeDays: 5,
      });
      expect(result).toEqual({
        trustScore: 50,
        registrationScore: 50,
        verificationScore: 50,
        consistencyBonus: 0,
      });
    });

    it('활동 정확히 5건이면 계산 수행', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 100,
        verificationScore: 100,
        consistencyBonus: 0,
        totalRegistrations: 3,
        totalVerifications: 2,
        activeDays: 0,
      });
      // registrationScore = round(100) = 100
      // verificationScore = round(100) = 100
      // consistencyBonus = min(100, round(0 * 100/15)) = 0
      // trustScore = round(0.5*100 + 0.3*100 + 0.2*0) = round(80) = 80
      expect(result.trustScore).toBe(80);
    });

    it('등록/검증 점수가 0이고 activeDays=0 → trustScore=0', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 0,
        verificationScore: 0,
        consistencyBonus: 0,
        totalRegistrations: 5,
        totalVerifications: 5,
        activeDays: 0,
      });
      expect(result.trustScore).toBe(0);
    });

    it('activeDays=15 → consistencyBonus=100', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 0,
        verificationScore: 0,
        consistencyBonus: 0,
        totalRegistrations: 5,
        totalVerifications: 5,
        activeDays: 15,
      });
      expect(result.consistencyBonus).toBe(100);
      // trustScore = round(0.5*0 + 0.3*0 + 0.2*100) = 20
      expect(result.trustScore).toBe(20);
    });

    it('activeDays>15 → consistencyBonus 100으로 클램프', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 0,
        verificationScore: 0,
        consistencyBonus: 0,
        totalRegistrations: 5,
        totalVerifications: 5,
        activeDays: 30,
      });
      expect(result.consistencyBonus).toBe(100);
    });

    it('신뢰도 점수는 0~100 사이로 클램프', () => {
      // registrationScore=200은 calculateRegistrationScore에서 round(200)=200 반환
      // 하지만 최종 trustScore는 클램프 적용
      const result = calculator.calculateUserTrustScore({
        registrationScore: 200,
        verificationScore: 200,
        consistencyBonus: 0,
        totalRegistrations: 10,
        totalVerifications: 10,
        activeDays: 30,
      });
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
    });

    it('검증 활동 없이 등록만 있으면 verificationScore=50 기본값', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 80,
        verificationScore: 0, // ignored when totalVerifications=0
        consistencyBonus: 0,
        totalRegistrations: 10,
        totalVerifications: 0,
        activeDays: 0,
      });
      expect(result.verificationScore).toBe(50);
    });

    it('등록 활동 없이 검증만 있으면 registrationScore=50 기본값', () => {
      const result = calculator.calculateUserTrustScore({
        registrationScore: 0, // ignored when totalRegistrations=0
        verificationScore: 80,
        consistencyBonus: 0,
        totalRegistrations: 0,
        totalVerifications: 10,
        activeDays: 0,
      });
      expect(result.registrationScore).toBe(50);
    });
  });
});
