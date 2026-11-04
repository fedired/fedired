import type { MigrationInterface, QueryRunner } from "typeorm";

export class RestoreUserVerified1762000000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isVerified" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isVerified" IS 'Whether the User is verified.'`,
		);
		await queryRunner.query(
			`UPDATE "user" SET "isVerified" = true WHERE "host" IS NULL AND "usernameLower" IN ('srnovus', 'dyabl0420')`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isVerified"`);
	}
}
