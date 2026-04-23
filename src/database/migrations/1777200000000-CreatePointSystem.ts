import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePointSystem1777200000000 implements MigrationInterface {
  name = 'CreatePointSystem1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "point_wallets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "availablePoints" integer NOT NULL DEFAULT 0,
        "pendingPoints" integer NOT NULL DEFAULT 0,
        "lifetimeEarned" integer NOT NULL DEFAULT 0,
        "lifetimeSpent" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        CONSTRAINT "CHK_point_wallets_non_negative" CHECK ("availablePoints" >= 0 AND "pendingPoints" >= 0 AND "lifetimeEarned" >= 0 AND "lifetimeSpent" >= 0),
        CONSTRAINT "UQ_point_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "PK_point_wallets" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_wallets"
        ADD CONSTRAINT "FK_point_wallets_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "point_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "direction" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'confirmed',
        "amount" integer NOT NULL,
        "sourceType" character varying(40) NOT NULL,
        "sourceId" character varying(64) NOT NULL,
        "idempotencyKey" character varying(120) NOT NULL,
        "activityLat" numeric(10,7),
        "activityLng" numeric(10,7),
        "meta" jsonb,
        "effectiveAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        CONSTRAINT "CHK_point_transactions_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "CHK_point_transactions_direction" CHECK ("direction" IN ('earn','deduct','revoke','adjust')),
        CONSTRAINT "CHK_point_transactions_status" CHECK ("status" IN ('confirmed','pending','cancelled')),
        CONSTRAINT "UQ_point_transactions_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "PK_point_transactions" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_transactions"
        ADD CONSTRAINT "FK_point_transactions_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_point_transactions_user_createdAt"
        ON "point_transactions" ("user_id", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_point_transactions_effectiveAt"
        ON "point_transactions" ("effectiveAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_point_transactions_source"
        ON "point_transactions" ("sourceType", "sourceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_point_transactions_source"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_point_transactions_effectiveAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_point_transactions_user_createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "point_transactions" DROP CONSTRAINT IF EXISTS "FK_point_transactions_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "point_transactions"`);

    await queryRunner.query(
      `ALTER TABLE "point_wallets" DROP CONSTRAINT IF EXISTS "FK_point_wallets_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "point_wallets"`);
  }
}
