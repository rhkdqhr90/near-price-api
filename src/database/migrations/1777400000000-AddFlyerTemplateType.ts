import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlyerTemplateType1777400000000 implements MigrationInterface {
  name = 'AddFlyerTemplateType1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "flyers" ADD COLUMN "templateType" character varying NOT NULL DEFAULT 'classic'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "flyers" DROP COLUMN "templateType"`);
  }
}
