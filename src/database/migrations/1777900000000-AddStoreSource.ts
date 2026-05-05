import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreSource1777900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // stores.source: 'USER' | 'PUBLIC_DATA'
    // 기존 행은 모두 사용자가 등록했거나 외부 API 결과로 만들어진 것이라 USER 로 채운다.
    await queryRunner.query(
      `ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stores_source" ON "stores" ("source")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stores_source"`);
    await queryRunner.query(
      `ALTER TABLE "stores" DROP COLUMN IF EXISTS "source"`,
    );
  }
}
