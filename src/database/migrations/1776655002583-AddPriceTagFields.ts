import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceTagFields1776655002583 implements MigrationInterface {
  name = 'AddPriceTagFields1776655002583';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_stores_latitude_longitude"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_prices_product_active_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "priceTagType" character varying(20) NOT NULL DEFAULT 'normal'`,
    );
    await queryRunner.query(`ALTER TABLE "prices" ADD "originalPrice" integer`);
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "bundleType" character varying(10)`,
    );
    await queryRunner.query(`ALTER TABLE "prices" ADD "bundleQty" integer`);
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "flatGroupName" character varying(50)`,
    );
    await queryRunner.query(`ALTER TABLE "prices" ADD "memberPrice" integer`);
    await queryRunner.query(`ALTER TABLE "prices" ADD "endsAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "cardLabel" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "cardDiscountType" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "cardDiscountValue" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "cardConditionNote" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "note" character varying(200)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "note"`);
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN "cardConditionNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN "cardDiscountValue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN "cardDiscountType"`,
    );
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "cardLabel"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "endsAt"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "memberPrice"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "flatGroupName"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "bundleQty"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "bundleType"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "originalPrice"`);
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "priceTagType"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_prices_product_active_price" ON "prices" ("price", "product_id", "isActive") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stores_latitude_longitude" ON "stores" ("latitude", "longitude") `,
    );
  }
}
