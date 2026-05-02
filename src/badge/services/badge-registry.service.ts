import { Injectable } from '@nestjs/common';
import {
  BADGE_DEFINITIONS,
  BADGE_DEFINITIONS_BY_ID,
  BadgeRule,
} from '../data/badge-definitions';
import { RepresentativeBadgeDto } from '../dto/representative-badge.dto';

/**
 * 뱃지 메타데이터 조회 전용 — DB 의존 없음, in-memory 상수 lookup만 수행.
 *
 * `BadgeEvaluatorService`(DB 무거움)와 분리한 이유:
 *  - Auth/User/Price 서비스가 닉네임 옆 표시용 뱃지 이름만 필요할 때 평가 서비스 전체를 끌고
 *    들어오면 의존성이 비대해진다.
 *  - 카드 빌더처럼 row 마다 호출되는 hot path도 안전하게 사용 가능 (O(1) Map lookup).
 */
@Injectable()
export class BadgeRegistryService {
  findById(id: string): BadgeRule | undefined {
    return BADGE_DEFINITIONS_BY_ID.get(id);
  }

  getAll(): readonly BadgeRule[] {
    return BADGE_DEFINITIONS;
  }

  /**
   * `User.representativeBadgeId` → 응답 DTO 변환의 단일 진입점.
   *
   * - id가 null/undefined → null
   * - id 있는데 정의 없음 → null (정의 제거된 stale 데이터, 호출 측에서 cleanup 책임)
   *
   * 호출 측에서 동일 분기를 반복하지 않도록 한 곳에 모은다.
   */
  resolveRepresentative(
    id: string | null | undefined,
  ): RepresentativeBadgeDto | null {
    if (!id) return null;
    const def = this.findById(id);
    if (!def) return null;
    return RepresentativeBadgeDto.fromDefinition(def);
  }
}
