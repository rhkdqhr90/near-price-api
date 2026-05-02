import { IsDefined, IsString, Length, ValidateIf } from 'class-validator';

/**
 * 대표 뱃지 설정/해제 요청.
 *
 * - `{ "type": "masil_3" }` → 설정 (BadgeDefinition.id)
 * - `{ "type": null }`      → 해제
 * - `{}` 또는 `{ "type": "" }` → 400 (모호한 입력 거부)
 *
 * 빈 문자열을 null로 자동 강제(coerce)하지 않는다 — 클라이언트가 의도를 명시해야
 * 서버 로직 분기가 결정된다. (이전 구현은 컨트롤러에서 임시 변환을 했으나 폴백 패턴이라 제거)
 */
export class SetRepresentativeBadgeDto {
  @IsDefined({ message: 'type 필드가 누락되었습니다 (string 또는 null 필요)' })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 50, {
    message: 'type은 1~50자 문자열 또는 null이어야 합니다',
  })
  type!: string | null;
}
