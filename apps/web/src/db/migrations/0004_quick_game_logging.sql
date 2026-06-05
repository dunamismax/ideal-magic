ALTER TABLE "core"."game_players" ADD COLUMN "participant_name_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "deck_name_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "commander_snapshot" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "color_identity_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "bracket_snapshot" text;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "power_estimate_snapshot" integer;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "archetype_snapshot" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_color_identity_snapshot_check" CHECK ("core"."game_players"."color_identity_snapshot" ~ '^[WUBRG]*$');--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_bracket_snapshot_check" CHECK ("core"."game_players"."bracket_snapshot" is null or "core"."game_players"."bracket_snapshot" in ('1', '2', '3', '4', '5'));--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_power_estimate_snapshot_check" CHECK ("core"."game_players"."power_estimate_snapshot" is null or "core"."game_players"."power_estimate_snapshot" between 1 and 10);
