ALTER TABLE "core"."game_players" ADD COLUMN "loss_reason" text;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "loss_detail" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "poison_counters" integer;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "commander_damage_source" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD COLUMN "commander_damage_amount" integer;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_loss_reason_check" CHECK ("core"."game_players"."loss_reason" is null or "core"."game_players"."loss_reason" in ('combat_damage', 'commander_damage', 'poison', 'combo', 'concession', 'decked', 'life_total', 'other', 'unknown'));--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_poison_counters_positive" CHECK ("core"."game_players"."poison_counters" is null or "core"."game_players"."poison_counters" > 0);--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_commander_damage_amount_positive" CHECK ("core"."game_players"."commander_damage_amount" is null or "core"."game_players"."commander_damage_amount" > 0);--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_poison_loss_has_counters" CHECK ("core"."game_players"."loss_reason" is distinct from 'poison' or "core"."game_players"."poison_counters" is not null);--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_commander_loss_has_details" CHECK ("core"."game_players"."loss_reason" is distinct from 'commander_damage' or ("core"."game_players"."commander_damage_amount" is not null and length(btrim("core"."game_players"."commander_damage_source")) > 0));
