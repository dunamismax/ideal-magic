ALTER TABLE "core"."event_rsvps" ADD COLUMN "guest_edit_token_hash" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvps_guest_edit_token_hash_key" ON "core"."event_rsvps" USING btree ("guest_edit_token_hash") WHERE "guest_edit_token_hash" is not null;
