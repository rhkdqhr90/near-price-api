import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotifications1776656825386 implements MigrationInterface {
    name = 'CreateNotifications1776656825386'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(30) NOT NULL, "title" character varying(100) NOT NULL, "body" character varying(300) NOT NULL, "linkType" character varying(20), "linkId" character varying(500), "imageUrl" character varying(500), "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c24be561656e7219e2566f6774" ON "notifications" ("user_id", "isRead", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c24be561656e7219e2566f6774"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
