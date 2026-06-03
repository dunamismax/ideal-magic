CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "meta";
--> statement-breakpoint
CREATE TABLE "core"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"password_hash" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_id_not_blank" CHECK (length(btrim("core"."accounts"."provider_id")) > 0),
	CONSTRAINT "accounts_account_id_not_blank" CHECK (length(btrim("core"."accounts"."account_id")) > 0),
	CONSTRAINT "accounts_password_hash_not_blank" CHECK ("core"."accounts"."password_hash" is null or length(btrim("core"."accounts"."password_hash")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_not_blank" CHECK (length(btrim("core"."sessions"."token_hash")) > 0),
	CONSTRAINT "sessions_expire_after_create" CHECK ("core"."sessions"."expires_at" > "core"."sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK ("core"."users"."email" = lower("core"."users"."email")),
	CONSTRAINT "users_email_shape" CHECK ("core"."users"."email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	CONSTRAINT "users_name_not_blank" CHECK (length(btrim("core"."users"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "verifications_kind_check" CHECK ("core"."verifications"."kind" in ('email_verification', 'password_reset', 'magic_link')),
	CONSTRAINT "verifications_identifier_not_blank" CHECK (length(btrim("core"."verifications"."identifier")) > 0),
	CONSTRAINT "verifications_token_hash_not_blank" CHECK (length(btrim("core"."verifications"."token_hash")) > 0),
	CONSTRAINT "verifications_expire_after_create" CHECK ("core"."verifications"."expires_at" > "core"."verifications"."created_at")
);
--> statement-breakpoint
CREATE TABLE "core"."house_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"visible_to_guests" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "house_rules_title_not_blank" CHECK (length(btrim("core"."house_rules"."title")) > 0),
	CONSTRAINT "house_rules_body_not_blank" CHECK (length(btrim("core"."house_rules"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."playgroup_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"email" text,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playgroup_invites_token_hash_not_blank" CHECK (length(btrim("core"."playgroup_invites"."token_hash")) > 0),
	CONSTRAINT "playgroup_invites_role_check" CHECK ("core"."playgroup_invites"."role" in ('owner', 'admin', 'member', 'host', 'guest', 'viewer')),
	CONSTRAINT "playgroup_invites_email_lowercase" CHECK ("core"."playgroup_invites"."email" is null or "core"."playgroup_invites"."email" = lower("core"."playgroup_invites"."email")),
	CONSTRAINT "playgroup_invites_max_uses_positive" CHECK ("core"."playgroup_invites"."max_uses" is null or "core"."playgroup_invites"."max_uses" > 0),
	CONSTRAINT "playgroup_invites_used_count_nonnegative" CHECK ("core"."playgroup_invites"."used_count" >= 0),
	CONSTRAINT "playgroup_invites_used_count_within_limit" CHECK ("core"."playgroup_invites"."max_uses" is null or "core"."playgroup_invites"."used_count" <= "core"."playgroup_invites"."max_uses")
);
--> statement-breakpoint
CREATE TABLE "core"."playgroup_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"display_name" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playgroup_memberships_role_check" CHECK ("core"."playgroup_memberships"."role" in ('owner', 'admin', 'member', 'host', 'guest', 'viewer')),
	CONSTRAINT "playgroup_memberships_display_name_not_blank" CHECK ("core"."playgroup_memberships"."display_name" is null or length(btrim("core"."playgroup_memberships"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."playgroups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playgroups_name_not_blank" CHECK (length(btrim("core"."playgroups"."name")) > 0),
	CONSTRAINT "playgroups_slug_shape" CHECK ("core"."playgroups"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "core"."event_guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_guests_name_not_blank" CHECK (length(btrim("core"."event_guests"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."event_hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"address_visibility" text DEFAULT 'rsvps' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_hosts_address_visibility_check" CHECK ("core"."event_hosts"."address_visibility" in ('rsvps', 'members', 'public', 'hidden'))
);
--> statement-breakpoint
CREATE TABLE "core"."event_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state_province" text,
	"postal_code" text,
	"country" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_locations_name_not_blank" CHECK (length(btrim("core"."event_locations"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."event_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"status" text NOT NULL,
	"arrival_time" timestamp with time zone,
	"leaving_time" timestamp with time zone,
	"guest_count" integer DEFAULT 0 NOT NULL,
	"travel_buffer_minutes" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_rsvps_status_check" CHECK ("core"."event_rsvps"."status" in ('yes', 'maybe', 'no', 'waitlist')),
	CONSTRAINT "event_rsvps_guest_count_nonnegative" CHECK ("core"."event_rsvps"."guest_count" >= 0),
	CONSTRAINT "event_rsvps_user_or_guest_name" CHECK (("core"."event_rsvps"."user_id" is not null and "core"."event_rsvps"."guest_name" is null) or ("core"."event_rsvps"."user_id" is null and "core"."event_rsvps"."guest_name" is not null and length(btrim("core"."event_rsvps"."guest_name")) > 0)),
	CONSTRAINT "event_rsvps_leaving_after_arrival" CHECK ("core"."event_rsvps"."leaving_time" is null or "core"."event_rsvps"."arrival_time" is null or "core"."event_rsvps"."leaving_time" > "core"."event_rsvps"."arrival_time")
);
--> statement-breakpoint
CREATE TABLE "core"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"location_id" uuid,
	"visibility" text DEFAULT 'members' NOT NULL,
	"invite_token_hash" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_title_not_blank" CHECK (length(btrim("core"."events"."title")) > 0),
	CONSTRAINT "events_visibility_check" CHECK ("core"."events"."visibility" in ('members', 'invite_only', 'public_safe')),
	CONSTRAINT "events_ends_after_start" CHECK ("core"."events"."ends_at" is null or "core"."events"."ends_at" > "core"."events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "core"."decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"playgroup_id" uuid,
	"name" text NOT NULL,
	"commanders" text[] NOT NULL,
	"color_identity" text DEFAULT '' NOT NULL,
	"bracket" text,
	"power_estimate" integer,
	"archetype" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"external_url" text,
	"game_changers_count" integer DEFAULT 0 NOT NULL,
	"has_infinite_combo" boolean DEFAULT false NOT NULL,
	"has_fast_mana" boolean DEFAULT false NOT NULL,
	"tutor_density" text DEFAULT 'none' NOT NULL,
	"has_extra_turns" boolean DEFAULT false NOT NULL,
	"has_mass_land_denial" boolean DEFAULT false NOT NULL,
	"salt_notes" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_name_not_blank" CHECK (length(btrim("core"."decks"."name")) > 0),
	CONSTRAINT "decks_has_commander" CHECK (cardinality("core"."decks"."commanders") > 0),
	CONSTRAINT "decks_commanders_not_blank" CHECK (array_position("core"."decks"."commanders", '') is null),
	CONSTRAINT "decks_color_identity_check" CHECK ("core"."decks"."color_identity" ~ '^[WUBRG]*$'),
	CONSTRAINT "decks_bracket_check" CHECK ("core"."decks"."bracket" is null or "core"."decks"."bracket" in ('1', '2', '3', '4', '5')),
	CONSTRAINT "decks_power_estimate_check" CHECK ("core"."decks"."power_estimate" is null or "core"."decks"."power_estimate" between 1 and 10),
	CONSTRAINT "decks_visibility_check" CHECK ("core"."decks"."visibility" in ('private', 'playgroup', 'public')),
	CONSTRAINT "decks_status_check" CHECK ("core"."decks"."status" in ('active', 'retired')),
	CONSTRAINT "decks_game_changers_count_nonnegative" CHECK ("core"."decks"."game_changers_count" >= 0),
	CONSTRAINT "decks_tutor_density_check" CHECK ("core"."decks"."tutor_density" in ('none', 'low', 'medium', 'high')),
	CONSTRAINT "decks_playgroup_visibility_scope" CHECK ("core"."decks"."visibility" <> 'playgroup' or "core"."decks"."playgroup_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "core"."event_deck_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"preference" integer DEFAULT 1 NOT NULL,
	"commander_snapshot" text[] NOT NULL,
	"deck_name_snapshot" text NOT NULL,
	"color_identity_snapshot" text DEFAULT '' NOT NULL,
	"bracket_snapshot" text,
	"testing_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_deck_declarations_preference_check" CHECK ("core"."event_deck_declarations"."preference" between 1 and 5),
	CONSTRAINT "event_deck_declarations_has_commander_snapshot" CHECK (cardinality("core"."event_deck_declarations"."commander_snapshot") > 0),
	CONSTRAINT "event_deck_declarations_deck_name_snapshot_not_blank" CHECK (length(btrim("core"."event_deck_declarations"."deck_name_snapshot")) > 0),
	CONSTRAINT "event_deck_declarations_color_identity_snapshot_check" CHECK ("core"."event_deck_declarations"."color_identity_snapshot" ~ '^[WUBRG]*$')
);
--> statement-breakpoint
CREATE TABLE "core"."pod_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pod_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"rsvp_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"deck_declaration_id" uuid,
	"deck_id" uuid,
	"seat_position" integer NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"arrival_time" timestamp with time zone,
	"leaving_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pod_seats_position_positive" CHECK ("core"."pod_seats"."seat_position" > 0),
	CONSTRAINT "pod_seats_user_or_guest_name" CHECK (("core"."pod_seats"."user_id" is not null and "core"."pod_seats"."guest_name" is null) or ("core"."pod_seats"."user_id" is null and "core"."pod_seats"."guest_name" is not null and length(btrim("core"."pod_seats"."guest_name")) > 0))
);
--> statement-breakpoint
CREATE TABLE "core"."pods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"position" integer NOT NULL,
	"size_fit_score" integer DEFAULT 0 NOT NULL,
	"bracket_compatibility_score" integer DEFAULT 0 NOT NULL,
	"repeat_player_pair_penalty" integer DEFAULT 0 NOT NULL,
	"repeat_deck_matchup_penalty" integer DEFAULT 0 NOT NULL,
	"guest_placement_score" integer DEFAULT 0 NOT NULL,
	"availability_window_score" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"scoring_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pods_name_not_blank" CHECK (length(btrim("core"."pods"."name")) > 0),
	CONSTRAINT "pods_position_positive" CHECK ("core"."pods"."position" > 0),
	CONSTRAINT "pods_state_check" CHECK ("core"."pods"."state" in ('proposed', 'locked', 'active', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "core"."game_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"author_user_id" uuid,
	"note_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_notes_text_not_blank" CHECK (length(btrim("core"."game_notes"."note_text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"pod_seat_id" uuid,
	"user_id" uuid,
	"guest_name" text,
	"deck_id" uuid,
	"seat_position" integer NOT NULL,
	"finish_position" integer,
	"elimination_order" integer,
	"eliminated_turn" integer,
	"is_winner" boolean DEFAULT false NOT NULL,
	"team" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_seat_position_positive" CHECK ("core"."game_players"."seat_position" > 0),
	CONSTRAINT "game_players_finish_position_positive" CHECK ("core"."game_players"."finish_position" is null or "core"."game_players"."finish_position" > 0),
	CONSTRAINT "game_players_elimination_order_positive" CHECK ("core"."game_players"."elimination_order" is null or "core"."game_players"."elimination_order" > 0),
	CONSTRAINT "game_players_eliminated_turn_positive" CHECK ("core"."game_players"."eliminated_turn" is null or "core"."game_players"."eliminated_turn" > 0),
	CONSTRAINT "game_players_user_or_guest_name" CHECK (("core"."game_players"."user_id" is not null and "core"."game_players"."guest_name" is null) or ("core"."game_players"."user_id" is null and "core"."game_players"."guest_name" is not null and length(btrim("core"."game_players"."guest_name")) > 0))
);
--> statement-breakpoint
CREATE TABLE "core"."game_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"result_type" text NOT NULL,
	"winner_user_id" uuid,
	"winning_deck_id" uuid,
	"winning_team" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_results_result_type_check" CHECK ("core"."game_results"."result_type" in ('normal_win', 'combo_win', 'combat_win', 'concession', 'draw', 'time_called', 'unfinished', 'archenemy_win', 'team_win'))
);
--> statement-breakpoint
CREATE TABLE "core"."games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"pod_id" uuid,
	"logged_by_user_id" uuid,
	"result_type" text NOT NULL,
	"turn_count" integer,
	"duration_minutes" integer,
	"first_player_user_id" uuid,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_result_type_check" CHECK ("core"."games"."result_type" in ('normal_win', 'combo_win', 'combat_win', 'concession', 'draw', 'time_called', 'unfinished', 'archenemy_win', 'team_win')),
	CONSTRAINT "games_turn_count_positive" CHECK ("core"."games"."turn_count" is null or "core"."games"."turn_count" > 0),
	CONSTRAINT "games_duration_minutes_positive" CHECK ("core"."games"."duration_minutes" is null or "core"."games"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "meta"."matchup_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"playgroup_id" uuid NOT NULL,
	"left_user_id" uuid,
	"right_user_id" uuid,
	"left_deck_id" uuid,
	"right_deck_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchup_history_has_pair" CHECK (("meta"."matchup_history"."left_user_id" is not null and "meta"."matchup_history"."right_user_id" is not null) or ("meta"."matchup_history"."left_deck_id" is not null and "meta"."matchup_history"."right_deck_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"action_type" text NOT NULL,
	"actor_player_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"local_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_actions_sequence_positive" CHECK ("core"."life_counter_actions"."sequence" > 0),
	CONSTRAINT "life_counter_actions_action_type_not_blank" CHECK (length(btrim("core"."life_counter_actions"."action_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_commander_damage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"defending_player_id" uuid NOT NULL,
	"source_commander_id" uuid NOT NULL,
	"damage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_commander_damage_nonnegative" CHECK ("core"."life_counter_commander_damage"."damage" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_commanders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_order" integer DEFAULT 1 NOT NULL,
	"cast_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_commanders_name_not_blank" CHECK (length(btrim("core"."life_counter_commanders"."name")) > 0),
	CONSTRAINT "life_counter_commanders_source_order_positive" CHECK ("core"."life_counter_commanders"."source_order" > 0),
	CONSTRAINT "life_counter_commanders_cast_count_nonnegative" CHECK ("core"."life_counter_commanders"."cast_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"deck_id" uuid,
	"seat_position" integer NOT NULL,
	"display_name" text NOT NULL,
	"color" text NOT NULL,
	"starting_life" integer DEFAULT 40 NOT NULL,
	"current_life" integer DEFAULT 40 NOT NULL,
	"poison" integer DEFAULT 0 NOT NULL,
	"is_eliminated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_players_seat_position_positive" CHECK ("core"."life_counter_players"."seat_position" > 0),
	CONSTRAINT "life_counter_players_display_name_not_blank" CHECK (length(btrim("core"."life_counter_players"."display_name")) > 0),
	CONSTRAINT "life_counter_players_color_not_blank" CHECK (length(btrim("core"."life_counter_players"."color")) > 0),
	CONSTRAINT "life_counter_players_starting_life_positive" CHECK ("core"."life_counter_players"."starting_life" > 0),
	CONSTRAINT "life_counter_players_poison_nonnegative" CHECK ("core"."life_counter_players"."poison" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"event_id" uuid,
	"pod_id" uuid,
	"local_session_key" text NOT NULL,
	"mode" text NOT NULL,
	"save_state" text DEFAULT 'local_only' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"last_action_sequence" integer DEFAULT 0 NOT NULL,
	"raw_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_sessions_local_session_key_not_blank" CHECK (length(btrim("core"."life_counter_sessions"."local_session_key")) > 0),
	CONSTRAINT "life_counter_sessions_mode_check" CHECK ("core"."life_counter_sessions"."mode" in ('standalone', 'event', 'pod')),
	CONSTRAINT "life_counter_sessions_save_state_check" CHECK ("core"."life_counter_sessions"."save_state" in ('local_only', 'saved_to_group', 'sync_pending', 'conflicted')),
	CONSTRAINT "life_counter_sessions_last_action_sequence_nonnegative" CHECK ("core"."life_counter_sessions"."last_action_sequence" >= 0),
	CONSTRAINT "life_counter_sessions_link_scope_check" CHECK (("core"."life_counter_sessions"."mode" = 'standalone' and "core"."life_counter_sessions"."event_id" is null and "core"."life_counter_sessions"."pod_id" is null) or ("core"."life_counter_sessions"."mode" = 'event' and "core"."life_counter_sessions"."event_id" is not null and "core"."life_counter_sessions"."pod_id" is null) or ("core"."life_counter_sessions"."mode" = 'pod' and "core"."life_counter_sessions"."event_id" is not null and "core"."life_counter_sessions"."pod_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "core"."life_counter_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"action_sequence" integer NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_counter_snapshots_action_sequence_positive" CHECK ("core"."life_counter_snapshots"."action_sequence" > 0)
);
--> statement-breakpoint
ALTER TABLE "core"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_rules" ADD CONSTRAINT "house_rules_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."house_rules" ADD CONSTRAINT "house_rules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."playgroup_invites" ADD CONSTRAINT "playgroup_invites_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."playgroup_invites" ADD CONSTRAINT "playgroup_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."playgroup_memberships" ADD CONSTRAINT "playgroup_memberships_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."playgroup_memberships" ADD CONSTRAINT "playgroup_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."playgroups" ADD CONSTRAINT "playgroups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_guests" ADD CONSTRAINT "event_guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_guests" ADD CONSTRAINT "event_guests_rsvp_id_event_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "core"."event_rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_hosts" ADD CONSTRAINT "event_hosts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_hosts" ADD CONSTRAINT "event_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_locations" ADD CONSTRAINT "event_locations_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_locations" ADD CONSTRAINT "event_locations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."events" ADD CONSTRAINT "events_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."events" ADD CONSTRAINT "events_location_id_event_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."event_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."decks" ADD CONSTRAINT "decks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."decks" ADD CONSTRAINT "decks_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD CONSTRAINT "event_deck_declarations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD CONSTRAINT "event_deck_declarations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."event_deck_declarations" ADD CONSTRAINT "event_deck_declarations_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "core"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "core"."pods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_rsvp_id_event_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "core"."event_rsvps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_deck_declaration_id_event_deck_declarations_id_fk" FOREIGN KEY ("deck_declaration_id") REFERENCES "core"."event_deck_declarations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pod_seats" ADD CONSTRAINT "pod_seats_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pods" ADD CONSTRAINT "pods_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_notes" ADD CONSTRAINT "game_notes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "core"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_notes" ADD CONSTRAINT "game_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "core"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_pod_seat_id_pod_seats_id_fk" FOREIGN KEY ("pod_seat_id") REFERENCES "core"."pod_seats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_players" ADD CONSTRAINT "game_players_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_results" ADD CONSTRAINT "game_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "core"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_results" ADD CONSTRAINT "game_results_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."game_results" ADD CONSTRAINT "game_results_winning_deck_id_decks_id_fk" FOREIGN KEY ("winning_deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."games" ADD CONSTRAINT "games_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."games" ADD CONSTRAINT "games_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "core"."pods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."games" ADD CONSTRAINT "games_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."games" ADD CONSTRAINT "games_first_player_user_id_users_id_fk" FOREIGN KEY ("first_player_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "core"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_left_user_id_users_id_fk" FOREIGN KEY ("left_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_right_user_id_users_id_fk" FOREIGN KEY ("right_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_left_deck_id_decks_id_fk" FOREIGN KEY ("left_deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta"."matchup_history" ADD CONSTRAINT "matchup_history_right_deck_id_decks_id_fk" FOREIGN KEY ("right_deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_actions" ADD CONSTRAINT "life_counter_actions_session_id_life_counter_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."life_counter_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_actions" ADD CONSTRAINT "life_counter_actions_actor_player_id_life_counter_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "core"."life_counter_players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_commander_damage" ADD CONSTRAINT "life_counter_commander_damage_session_id_life_counter_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."life_counter_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_commander_damage" ADD CONSTRAINT "life_counter_commander_damage_defending_player_id_life_counter_players_id_fk" FOREIGN KEY ("defending_player_id") REFERENCES "core"."life_counter_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_commander_damage" ADD CONSTRAINT "life_counter_commander_damage_source_commander_id_life_counter_commanders_id_fk" FOREIGN KEY ("source_commander_id") REFERENCES "core"."life_counter_commanders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_commanders" ADD CONSTRAINT "life_counter_commanders_player_id_life_counter_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "core"."life_counter_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_players" ADD CONSTRAINT "life_counter_players_session_id_life_counter_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."life_counter_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_players" ADD CONSTRAINT "life_counter_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_players" ADD CONSTRAINT "life_counter_players_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "core"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_sessions" ADD CONSTRAINT "life_counter_sessions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_sessions" ADD CONSTRAINT "life_counter_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_sessions" ADD CONSTRAINT "life_counter_sessions_pod_id_pods_id_fk" FOREIGN KEY ("pod_id") REFERENCES "core"."pods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."life_counter_snapshots" ADD CONSTRAINT "life_counter_snapshots_session_id_life_counter_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."life_counter_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "core"."accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "core"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "core"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "core"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "core"."sessions" USING btree ("user_id","expires_at") WHERE "core"."sessions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "core"."users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_token_hash_key" ON "core"."verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "core"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "house_rules_playgroup_id_idx" ON "core"."house_rules" USING btree ("playgroup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playgroup_invites_token_hash_key" ON "core"."playgroup_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "playgroup_invites_playgroup_id_idx" ON "core"."playgroup_invites" USING btree ("playgroup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playgroup_memberships_user_key" ON "core"."playgroup_memberships" USING btree ("playgroup_id","user_id");--> statement-breakpoint
CREATE INDEX "playgroup_memberships_user_id_idx" ON "core"."playgroup_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playgroups_slug_key" ON "core"."playgroups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "event_guests_event_id_idx" ON "core"."event_guests" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_hosts_event_user_key" ON "core"."event_hosts" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_locations_playgroup_id_idx" ON "core"."event_locations" USING btree ("playgroup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvps_event_user_key" ON "core"."event_rsvps" USING btree ("event_id","user_id") WHERE "core"."event_rsvps"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "event_rsvps_event_id_idx" ON "core"."event_rsvps" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_invite_token_hash_key" ON "core"."events" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE INDEX "events_playgroup_id_idx" ON "core"."events" USING btree ("playgroup_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "core"."events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "decks_owner_user_id_idx" ON "core"."decks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "decks_playgroup_id_idx" ON "core"."decks" USING btree ("playgroup_id");--> statement-breakpoint
CREATE INDEX "decks_visibility_idx" ON "core"."decks" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "decks_tags_gin_idx" ON "core"."decks" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "event_deck_declarations_event_user_deck_key" ON "core"."event_deck_declarations" USING btree ("event_id","user_id","deck_id");--> statement-breakpoint
CREATE INDEX "event_deck_declarations_event_id_idx" ON "core"."event_deck_declarations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_deck_declarations_user_id_idx" ON "core"."event_deck_declarations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pod_seats_pod_position_key" ON "core"."pod_seats" USING btree ("pod_id","seat_position");--> statement-breakpoint
CREATE UNIQUE INDEX "pod_seats_event_rsvp_key" ON "core"."pod_seats" USING btree ("event_id","rsvp_id");--> statement-breakpoint
CREATE INDEX "pod_seats_event_id_idx" ON "core"."pod_seats" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pod_seats_user_id_idx" ON "core"."pod_seats" USING btree ("user_id") WHERE "core"."pod_seats"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "pod_seats_deck_id_idx" ON "core"."pod_seats" USING btree ("deck_id") WHERE "core"."pod_seats"."deck_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pods_event_position_key" ON "core"."pods" USING btree ("event_id","position");--> statement-breakpoint
CREATE INDEX "pods_event_id_idx" ON "core"."pods" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pods_state_idx" ON "core"."pods" USING btree ("state");--> statement-breakpoint
CREATE INDEX "game_notes_game_id_idx" ON "core"."game_notes" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_game_seat_key" ON "core"."game_players" USING btree ("game_id","seat_position");--> statement-breakpoint
CREATE INDEX "game_players_user_id_idx" ON "core"."game_players" USING btree ("user_id") WHERE "core"."game_players"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "game_players_deck_id_idx" ON "core"."game_players" USING btree ("deck_id") WHERE "core"."game_players"."deck_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_results_game_id_key" ON "core"."game_results" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_results_winner_user_id_idx" ON "core"."game_results" USING btree ("winner_user_id") WHERE "core"."game_results"."winner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "game_results_winning_deck_id_idx" ON "core"."game_results" USING btree ("winning_deck_id") WHERE "core"."game_results"."winning_deck_id" is not null;--> statement-breakpoint
CREATE INDEX "games_event_id_idx" ON "core"."games" USING btree ("event_id","completed_at");--> statement-breakpoint
CREATE INDEX "games_pod_id_idx" ON "core"."games" USING btree ("pod_id") WHERE "core"."games"."pod_id" is not null;--> statement-breakpoint
CREATE INDEX "games_result_type_idx" ON "core"."games" USING btree ("result_type");--> statement-breakpoint
CREATE INDEX "games_tags_gin_idx" ON "core"."games" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "matchup_history_game_user_pair_key" ON "meta"."matchup_history" USING btree ("game_id","left_user_id","right_user_id") WHERE "meta"."matchup_history"."left_user_id" is not null and "meta"."matchup_history"."right_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "matchup_history_game_deck_pair_key" ON "meta"."matchup_history" USING btree ("game_id","left_deck_id","right_deck_id") WHERE "meta"."matchup_history"."left_deck_id" is not null and "meta"."matchup_history"."right_deck_id" is not null;--> statement-breakpoint
CREATE INDEX "matchup_history_playgroup_event_idx" ON "meta"."matchup_history" USING btree ("playgroup_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_actions_session_sequence_key" ON "core"."life_counter_actions" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "life_counter_actions_session_id_idx" ON "core"."life_counter_actions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_commander_damage_source_defender_key" ON "core"."life_counter_commander_damage" USING btree ("session_id","defending_player_id","source_commander_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_commanders_player_order_key" ON "core"."life_counter_commanders" USING btree ("player_id","source_order");--> statement-breakpoint
CREATE INDEX "life_counter_commanders_player_id_idx" ON "core"."life_counter_commanders" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_players_session_seat_key" ON "core"."life_counter_players" USING btree ("session_id","seat_position");--> statement-breakpoint
CREATE INDEX "life_counter_players_session_id_idx" ON "core"."life_counter_players" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_sessions_local_session_key_key" ON "core"."life_counter_sessions" USING btree ("local_session_key");--> statement-breakpoint
CREATE INDEX "life_counter_sessions_owner_user_id_idx" ON "core"."life_counter_sessions" USING btree ("owner_user_id") WHERE "core"."life_counter_sessions"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "life_counter_sessions_event_id_idx" ON "core"."life_counter_sessions" USING btree ("event_id") WHERE "core"."life_counter_sessions"."event_id" is not null;--> statement-breakpoint
CREATE INDEX "life_counter_sessions_pod_id_idx" ON "core"."life_counter_sessions" USING btree ("pod_id") WHERE "core"."life_counter_sessions"."pod_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "life_counter_snapshots_session_sequence_key" ON "core"."life_counter_snapshots" USING btree ("session_id","action_sequence");