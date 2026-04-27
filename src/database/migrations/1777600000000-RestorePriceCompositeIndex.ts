import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestorePriceCompositeIndex1777600000000 implements MigrationInterface {
  name = 'RestorePriceCompositeIndex1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prices_product_active_price"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_prices_product_active_price" ON "prices" ("product_id", "isActive", "price")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prices_product_active_price"`,
    );
  }
}
