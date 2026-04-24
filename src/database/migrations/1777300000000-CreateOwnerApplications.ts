import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOwnerApplications1777300000000 implements MigrationInterface {
  name = 'CreateOwnerApplications1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."owner_applications_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );

    await queryRunner.query(
      `CREATE TABLE "owner_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerName" character varying(100) NOT NULL,
        "ownerPhone" character varying(30) NOT NULL,
        "businessRegistrationNumberEncrypted" text NOT NULL,
        "businessRegistrationNumberMasked" character varying(20) NOT NULL,
        "proofImageUrl" text NOT NULL,
        "status" "public"."owner_applications_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" text,
        "reviewedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "reviewed_by_admin_id" uuid,
        CONSTRAINT "PK_owner_applications_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_owner_applications_user_id" ON "owner_applications" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_owner_applications_status" ON "owner_applications" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_owner_applications_created_at" ON "owner_applications" ("createdAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "owner_applications"
       ADD CONSTRAINT "FK_owner_applications_user_id"
       FOREIGN KEY ("user_id") REFERENCES "users"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "owner_applications"
       ADD CONSTRAINT "FK_owner_applications_store_id"
       FOREIGN KEY ("store_id") REFERENCES "stores"("id")
       ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "owner_applications"
       ADD CONSTRAINT "FK_owner_applications_reviewed_by_admin_id"
       FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "flyers" ADD COLUMN "owner_application_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_flyers_owner_application_id" ON "flyers" ("owner_application_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "flyers"
       ADD CONSTRAINT "FK_flyers_owner_application_id"
       FOREIGN KEY ("owner_application_id") REFERENCES "owner_applications"("id")
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flyers" DROP CONSTRAINT "FK_flyers_owner_application_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_flyers_owner_application_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flyers" DROP COLUMN "owner_application_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "owner_applications" DROP CONSTRAINT "FK_owner_applications_reviewed_by_admin_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "owner_applications" DROP CONSTRAINT "FK_owner_applications_store_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "owner_applications" DROP CONSTRAINT "FK_owner_applications_user_id"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_owner_applications_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_owner_applications_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_owner_applications_user_id"`,
    );

    await queryRunner.query(`DROP TABLE "owner_applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."owner_applications_status_enum"`,
    );
  }
}
