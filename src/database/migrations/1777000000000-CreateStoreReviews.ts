import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoreReviews1777000000000 implements MigrationInterface {
  name = 'CreateStoreReviews1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "store_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "rating" integer NOT NULL,
        "comment" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_reviews_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_store_reviews_store'
        ) THEN
          ALTER TABLE "store_reviews"
            ADD CONSTRAINT "FK_store_reviews_store"
            FOREIGN KEY ("store_id") REFERENCES "stores"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_store_reviews_user'
        ) THEN
          ALTER TABLE "store_reviews"
            ADD CONSTRAINT "FK_store_reviews_user"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_reviews_store_user_unique"
      ON "store_reviews" ("store_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_store_reviews_store_user_unique"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_reviews" DROP CONSTRAINT IF EXISTS "FK_store_reviews_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_reviews" DROP CONSTRAINT IF EXISTS "FK_store_reviews_store"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "store_reviews"`);
  }
}
