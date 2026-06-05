CREATE TABLE "core"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"playgroup_id" uuid,
	"event_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_action_shape" CHECK ("core"."audit_events"."action" ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
	CONSTRAINT "audit_events_target_type_shape" CHECK ("core"."audit_events"."target_type" ~ '^[a-z0-9_]+$'),
	CONSTRAINT "audit_events_metadata_object" CHECK (jsonb_typeof("core"."audit_events"."metadata") = 'object')
);
--> statement-breakpoint
ALTER TABLE "core"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "core"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "core"."audit_events" ADD CONSTRAINT "audit_events_playgroup_id_playgroups_id_fk" FOREIGN KEY ("playgroup_id") REFERENCES "core"."playgroups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "core"."audit_events" ADD CONSTRAINT "audit_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "audit_events_actor_user_id_idx" ON "core"."audit_events" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX "audit_events_event_id_idx" ON "core"."audit_events" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "audit_events_playgroup_created_at_idx" ON "core"."audit_events" USING btree ("playgroup_id","created_at");
--> statement-breakpoint
CREATE INDEX "audit_events_action_created_at_idx" ON "core"."audit_events" USING btree ("action","created_at");
