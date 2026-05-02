import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 뱃지 시스템을 5단계 티어 23개 뱃지로 재정비.
 *
 * 1) badge_definitions 에 `tier` 컬럼 추가 (bronze/silver/gold/platinum/mythic).
 *    기존 row는 'bronze' 기본값. 신규 23개 뱃지 정의 자체는 평가 시 in-memory
 *    BADGE_DEFINITIONS 배열을 사용하므로 테이블 시드 갱신은 후속 작업으로 분리.
 *
 * 2) users 에 `representativeBadgeId` 컬럼 추가. 사용자가 BadgeScreen에서
 *    선택한 대표 뱃지(글 작성 시 닉네임 옆 표시) 보관.
 */
export class AddBadgeTierAndRepresentative1777700000000 implements MigrationInterface {
  name = 'AddBadgeTierAndRepresentative1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) badge_definitions.tier
    await queryRunner.query(
      `CREATE TYPE "badge_definitions_tier_enum" AS ENUM('bronze', 'silver', 'gold', 'platinum', 'mythic')`,
    );
    await queryRunner.query(
      `ALTER TABLE "badge_definitions" ADD COLUMN "tier" "badge_definitions_tier_enum" NOT NULL DEFAULT 'bronze'`,
    );

    // 2) users.representativeBadgeId (BadgeDefinition.id 참조, FK는 두지 않음 — soft reference)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "representativeBadgeId" character varying(50) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "representativeBadgeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "badge_definitions" DROP COLUMN "tier"`,
    );
    await queryRunner.query(`DROP TYPE "badge_definitions_tier_enum"`);
  }
}
