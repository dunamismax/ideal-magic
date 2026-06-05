ALTER TABLE "core"."event_locations" ADD COLUMN "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "event_locations_playgroup_archived_idx" ON "core"."event_locations" USING btree ("playgroup_id","archived_at");
