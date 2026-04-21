import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncEntityDrift1776488112926 implements MigrationInterface {
  name = 'SyncEntityDrift1776488112926';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inquiries" DROP CONSTRAINT IF EXISTS "FK_f4e1f635f2d312e6ae95c8a3a58"`,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'inquiries'
            AND column_name = 'userId'
        ) THEN
          ALTER TABLE "inquiries" RENAME COLUMN "userId" TO "user_id";
        END IF;
      END
      $$;`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" DROP COLUMN IF EXISTS "sourceVerificationId"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_06204d0b71b373dd81ee815bcd" ON "stores" ("latitude", "longitude") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_9952bb20656722a523033b6c0a" ON "price_verifications" ("verifier_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_db5380e3155483af0368aa4a36" ON "price_verifications" ("price_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_a896a1864d60d5707403e0a081" ON "inquiries" ("user_id") `,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'inquiries'
            AND column_name = 'user_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_a896a1864d60d5707403e0a0810'
        ) THEN
          ALTER TABLE "inquiries"
          ADD CONSTRAINT "FK_a896a1864d60d5707403e0a0810"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inquiries" DROP CONSTRAINT IF EXISTS "FK_a896a1864d60d5707403e0a0810"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_a896a1864d60d5707403e0a081"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_db5380e3155483af0368aa4a36"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_9952bb20656722a523033b6c0a"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_06204d0b71b373dd81ee815bcd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "sourceVerificationId" uuid`,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'inquiries'
            AND column_name = 'user_id'
        ) THEN
          ALTER TABLE "inquiries" RENAME COLUMN "user_id" TO "userId";
        END IF;
      END
      $$;`,
    );
    await queryRunner.query(
      `DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'inquiries'
            AND column_name = 'userId'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_f4e1f635f2d312e6ae95c8a3a58'
        ) THEN
          ALTER TABLE "inquiries"
          ADD CONSTRAINT "FK_f4e1f635f2d312e6ae95c8a3a58"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;`,
    );
  }
}
