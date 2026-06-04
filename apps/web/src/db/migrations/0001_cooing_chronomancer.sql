ALTER TABLE "core"."accounts" RENAME COLUMN "password_hash" TO "password";--> statement-breakpoint
ALTER TABLE "core"."sessions" RENAME COLUMN "token_hash" TO "token";--> statement-breakpoint
ALTER TABLE "core"."verifications" RENAME COLUMN "token_hash" TO "value";--> statement-breakpoint
ALTER TABLE "core"."accounts" DROP CONSTRAINT "accounts_password_hash_not_blank";--> statement-breakpoint
ALTER TABLE "core"."sessions" DROP CONSTRAINT "sessions_token_hash_not_blank";--> statement-breakpoint
ALTER TABLE "core"."verifications" DROP CONSTRAINT "verifications_kind_check";--> statement-breakpoint
ALTER TABLE "core"."verifications" DROP CONSTRAINT "verifications_token_hash_not_blank";--> statement-breakpoint
DROP INDEX "core"."sessions_token_hash_key";--> statement-breakpoint
DROP INDEX "core"."verifications_token_hash_key";--> statement-breakpoint
ALTER TABLE "core"."users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "core"."sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_value_key" ON "core"."verifications" USING btree ("value");--> statement-breakpoint
ALTER TABLE "core"."users" DROP COLUMN "email_verified_at";--> statement-breakpoint
ALTER TABLE "core"."verifications" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "core"."accounts" ADD CONSTRAINT "accounts_password_not_blank" CHECK ("core"."accounts"."password" is null or length(btrim("core"."accounts"."password")) > 0);--> statement-breakpoint
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_token_not_blank" CHECK (length(btrim("core"."sessions"."token")) > 0);--> statement-breakpoint
ALTER TABLE "core"."verifications" ADD CONSTRAINT "verifications_value_not_blank" CHECK (length(btrim("core"."verifications"."value")) > 0);