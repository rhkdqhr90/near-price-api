import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoreLocationIndex1774333700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 근처 매장 조회 최적화 (BETWEEN latitude AND latitude, BETWEEN longitude AND longitude)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stores_latitude_longitude"
       ON "stores" ("latitude", "longitude")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stores_latitude_longitude"`,
    );
  }
}
