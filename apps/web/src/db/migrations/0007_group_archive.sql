ALTER TABLE "core"."playgroups" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "playgroups_archived_at_idx" ON "core"."playgroups" USING btree ("archived_at");
