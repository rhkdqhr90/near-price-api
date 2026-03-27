import { PriceTrustScoreCalculator } from './price-trust-score.calculator';
import { VerificationResult } from '../../price-verification/entities/price-verification.entity';

describe('PriceTrustScoreCalculator', () => {
  let calculator: PriceTrustScoreCalculator;

  beforeEach(() => {
    calculator = new PriceTrustScoreCalculator();
  });

  // ── calculatePriceTrustScore ─────────────────────────────────────────────

  describe('calculatePriceTrustScore', () => {
    it('검증이 없으면 status=new, score=null 반환', () => {
      const result = calculator.calculatePriceTrustScore([]);
      expect(result).toEqual({ score: null, status: 'new' });
    });

    it('검증이 10개 미만이면 status=verifying, score=null 반환', () => {
      const verifications = Array.from({ length: 9 }, () => ({
        result: VerificationResult.CONFIRMED,
        verifierTrustScore: 50,
      }));
      const result = calculator.calculatePriceTrustScore(verifications);
      expect(result).toEqual({ score: null, status: 'verifying' });
    });

    it('검증이 정확히 10개이면 점수 계산', () => {
      const verifications = Array.from({ length: 10 }, () => ({
        result: VerificationResult.CONFIRMED,
        verifierTrustScore: 50,
      }));
      const result = calculator.calculatePriceTrustScore(verifications);
      expect(result.status).toBe('scored');
      expect(result.score).toBe(100);
    });

    it('전체 맞아요(confirmed) → score=100', () => {
      const verifications = Array.from({ length: 15 }, () => ({
        result: VerificationResult.CONFIRMED,
        verifierTrustScore: 80,
      }));
      const result = calculator.calculatePriceTrustScore(verifications);
      expect(result.status).toBe('scored');
      expect(result.score).toBe(100);
    });

    it('전체 달라요(disputed) → score=0', () => {
      const verifications = Array.from({ length: 10 }, () => ({
        result: VerificationResult.DISPUTED,
        verifierTrustScore: 80,
      }));
      const result = calculator.calculatePriceTrustScore(verifications);
      expect(result.status).toBe('scored');
      expect(result.score).toBe(0);
    });

    it('맞아요 5개 + 달라요 5개 (동일 신뢰도) → score=50', () => {
      const confirmed = Array.from({ length: 5 }, () => ({
        result: VerificationResult.CONFIRMED,
        verifierTrustScore: 50,
      }));
      const disputed = Array.from({ length: 5 }, () => ({
        result: VerificationResult.DISPUTED,
        verifierTrustScore: 50,
      }));
      const result = calculator.calculatePriceTrustScore([
        ...confirmed,
        ...disputed,
      ]);
      expect(result.status).toBe('scored');
      expect(result.score).toBe(50);
    });

    it('신뢰도 높은 검증자의 맞아요가 가중치 더 높음', () => {
      // 신뢰도 100인 confirmed 5명 vs 신뢰도 0인 disputed 5명
      const highTrustConfirmed = Array.from({ length: 5 }, () => ({
        result: VerificationResult.CONFIRMED,
        verifierTrustScore: 100,
      }));
      const lowTrustDisputed = Array.from({ length: 5 }, () => ({
        result: VerificationResult.DISPUTED,
        verifierTrustScore: 0,
      }));
      const result = calculator.calculatePriceTrustScore([
        ...highTrustConfirmed,
        ...lowTrustDisputed,
      ]);
      // weight(100) = 1.0, weight(0) = 0.5
      // weightedSum = 5*1.0 = 5, weightTotal = 5*1.0 + 5*0.5 = 7.5
      // score = (5/7.5)*100 = 66.67
      expect(result.status).toBe('scored');
      expect(result.score).toBeGreaterThan(50);
    });
  });

  // ── isStalePrice ─────────────────────────────────────────────────────────

  describe('isStalePrice', () => {
    it('30일 이상 경과 → true', () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      expect(calculator.isStalePrice(thirtyOneDaysAgo)).toBe(true);
    });

    it('29일 경과 → false', () => {
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      expect(calculator.isStalePrice(twentyNineDaysAgo)).toBe(false);
    });

    it('방금 등록 → false', () => {
      expect(calculator.isStalePrice(new Date())).toBe(false);
    });
  });

  // ── getDaysSinceRegistered ───────────────────────────────────────────────

  describe('getDaysSinceRegistered', () => {
    it('10일 전 등록 → 10 반환', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(calculator.getDaysSinceRegistered(tenDaysAgo)).toBe(10);
    });

    it('오늘 등록 → 0 반환', () => {
      expect(calculator.getDaysSinceRegistered(new Date())).toBe(0);
    });
  });
});
