/**
 * 대표 뱃지 응답 DTO.
 * 사용자가 BadgeScreen에서 선택한 대표 뱃지를 닉네임 옆 InlineBadge 렌더에 사용.
 *
 * - `type`: BadgeDefinition.id (예: `masil_1` ~ `masil_23`)
 * - `name`: 사용자에게 노출되는 한글 뱃지명
 *
 * 미설정/박탈된 경우 응답에서 `null`로 노출한다.
 */
export class RepresentativeBadgeDto {
  type: string;
  name: string;

  static fromDefinition(def: {
    id: string;
    name: string;
  }): RepresentativeBadgeDto {
    const dto = new RepresentativeBadgeDto();
    dto.type = def.id;
    dto.name = def.name;
    return dto;
  }
}
