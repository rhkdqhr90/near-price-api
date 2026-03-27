import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceCompositeIndex1774333601289 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 상품별 활성 가격 조회 최적화
    // 쿼리 패턴: WHERE product_id = ? AND is_active = true ORDER BY price ASC
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prices_product_active_price"
       ON "prices" ("product_id", "isActive", "price")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_prices_product_active_price"`,
    );
  }
}
