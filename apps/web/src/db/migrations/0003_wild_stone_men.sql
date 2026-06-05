ALTER TABLE "core"."event_deck_declarations" ADD COLUMN "power_estimate_snapshot" integer;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD COLUMN "archetype_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD COLUMN "tags_snapshot" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD COLUMN "visibility_snapshot" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD COLUMN "external_url_snapshot" text;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD CONSTRAINT "event_deck_declarations_power_estimate_snapshot_check" CHECK ("core"."event_deck_declarations"."power_estimate_snapshot" is null or "core"."event_deck_declarations"."power_estimate_snapshot" between 1 and 10);--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD CONSTRAINT "event_deck_declarations_visibility_snapshot_check" CHECK ("core"."event_deck_declarations"."visibility_snapshot" in ('private', 'playgroup', 'public'));