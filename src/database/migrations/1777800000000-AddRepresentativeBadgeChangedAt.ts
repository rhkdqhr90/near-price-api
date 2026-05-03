import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.representativeBadgeChangedAt 추가.
 * 대표 뱃지 1시간 쿨다운 정책 — 잦은 토글로 인한 UX 혼란/DB write 방지.
 */
export class AddRepresentativeBadgeChangedAt1777800000000 implements MigrationInterface {
  name = 'AddRepresentativeBadgeChangedAt1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "representativeBadgeChangedAt" TIMESTAMP NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "representativeBadgeChangedAt"`,
    );
  }
}
