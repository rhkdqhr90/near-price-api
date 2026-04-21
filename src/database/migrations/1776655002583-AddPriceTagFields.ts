import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceTagFields1776655002583 implements MigrationInterface {
  name = 'AddPriceTagFields1776655002583';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_stores_latitude_longitude"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_prices_product_active_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "priceTagType" character varying(20) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "originalPrice" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "bundleType" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "bundleQty" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "flatGroupName" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "memberPrice" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "cardLabel" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "cardDiscountType" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "cardDiscountValue" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "cardConditionNote" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "note" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "note"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "cardConditionNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "cardDiscountValue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "cardDiscountType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "cardLabel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "endsAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "memberPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "flatGroupName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "bundleQty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "bundleType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "originalPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "priceTagType"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prices_product_active_price" ON "prices" ("price", "product_id", "isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stores_latitude_longitude" ON "stores" ("latitude", "longitude") `,
    );
  }
}
