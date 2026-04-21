import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UnitType 컬럼을 products → prices로 이관한다.
 *
 * 배경: 같은 이름의 상품이 단위(kg/g/개 등)에 따라 별도 상품으로 분리되어
 * 사용자 UX가 혼란스러웠다. 단위는 "개별 가격 등록"의 속성이므로
 * Price 엔티티로 이관한다.
 *
 * 절차:
 *  1) prices에 unitType(enum) 추가 — 기존 product의 unitType 값을 백필
 *  2) 동일 (LOWER(name), category) 상품 중복 병합
 *     - 가장 오래된 product를 대표로 남기고, 나머지의 prices.product_id / wishlists.product_id를 대표로 재지정
 *     - wishlists는 (user, product) 유니크 제약이 있으므로 중복 제거 후 재지정
 *     - 중복 products 삭제
 *  3) products.unitType 컬럼 및 enum 제거
 */
export class MovePriceUnitType1776900000000 implements MigrationInterface {
  name = 'MovePriceUnitType1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) prices.unitType enum + 컬럼 추가 (default 'other')
    await queryRunner.query(
      `CREATE TYPE "public"."prices_unittype_enum" AS ENUM('g', 'kg', 'ml', 'l', 'count', 'bunch', 'pack', 'bag', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD "unitType" "public"."prices_unittype_enum" NOT NULL DEFAULT 'other'`,
    );

    // 1-1) 기존 product의 unitType 값을 prices로 백필
    await queryRunner.query(
      `UPDATE "prices" p SET "unitType" = pr."unitType"::text::"public"."prices_unittype_enum"
       FROM "products" pr
       WHERE p."product_id" = pr."id" AND pr."unitType" IS NOT NULL`,
    );

    // 2) 동일 (LOWER(name), category) products 병합
    //    대표(keeper) = 가장 오래된 createdAt
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          LOWER(name) AS lname,
          category,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS rn,
          FIRST_VALUE(id) OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS keeper_id
        FROM "products"
      ),
      dups AS (
        SELECT id AS dup_id, keeper_id
        FROM ranked
        WHERE rn > 1
      )
      UPDATE "prices" p
      SET "product_id" = d.keeper_id
      FROM dups d
      WHERE p."product_id" = d.dup_id
    `);

    // 2-1) wishlists 병합: (user, product) 유니크 제약 고려.
    //      중복 product를 대표로 재지정하되, 동일 user가 이미 대표를 찜했다면 dup wishlist 삭제.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          LOWER(name) AS lname,
          category,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS rn,
          FIRST_VALUE(id) OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS keeper_id
        FROM "products"
      ),
      dups AS (
        SELECT id AS dup_id, keeper_id
        FROM ranked
        WHERE rn > 1
      )
      DELETE FROM "wishlists" w
      USING dups d
      WHERE w."product_id" = d.dup_id
        AND EXISTS (
          SELECT 1 FROM "wishlists" w2
          WHERE w2."user_id" = w."user_id"
            AND w2."product_id" = d.keeper_id
        )
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          LOWER(name) AS lname,
          category,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS rn,
          FIRST_VALUE(id) OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS keeper_id
        FROM "products"
      ),
      dups AS (
        SELECT id AS dup_id, keeper_id
        FROM ranked
        WHERE rn > 1
      )
      UPDATE "wishlists" w
      SET "product_id" = d.keeper_id
      FROM dups d
      WHERE w."product_id" = d.dup_id
    `);

    // 2-2) 중복 products 삭제
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(name), category
            ORDER BY "createdAt" ASC, id ASC
          ) AS rn
        FROM "products"
      )
      DELETE FROM "products" p
      USING ranked r
      WHERE p.id = r.id AND r.rn > 1
    `);

    // 3) products.unitType 컬럼 + enum 제거
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "unitType"`);
    await queryRunner.query(`DROP TYPE "public"."products_unittype_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // products.unitType 복원 (enum + 컬럼)
    await queryRunner.query(
      `CREATE TYPE "public"."products_unittype_enum" AS ENUM('g', 'kg', 'ml', 'l', 'count', 'bunch', 'pack', 'bag', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "unitType" "public"."products_unittype_enum" NOT NULL DEFAULT 'other'`,
    );

    // prices 대표값을 products로 역백필 (첫 price 기준)
    await queryRunner.query(`
      UPDATE "products" pr
      SET "unitType" = sub."unitType"::text::"public"."products_unittype_enum"
      FROM (
        SELECT DISTINCT ON (product_id)
          product_id, "unitType"
        FROM "prices"
        ORDER BY product_id, "createdAt" ASC
      ) sub
      WHERE pr.id = sub.product_id
    `);

    // 중복 병합은 복원 불가 — 그대로 둔다.

    // prices.unitType 제거
    await queryRunner.query(`ALTER TABLE "prices" DROP COLUMN "unitType"`);
    await queryRunner.query(`DROP TYPE "public"."prices_unittype_enum"`);
  }
}
