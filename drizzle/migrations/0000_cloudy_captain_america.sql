CREATE TABLE "lastward_public_pages" (
	"slug" varchar(128) PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_release_tokens" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_switch_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"type" varchar(24) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_switch_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"kind" varchar(12) NOT NULL,
	"step_key" varchar(128) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_switch_payloads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"mode" varchar(12) NOT NULL,
	"ciphertext" varchar(2000000),
	"wrapped_key" varchar(4096),
	"salt" varchar(512),
	"nonce" varchar(512),
	"algo" varchar(64),
	"blob_ref" varchar(512),
	"size" integer,
	"readable_content" varchar(200000),
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_switch_recipients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"switch_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(32),
	"name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lastward_switches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"state" varchar(16) DEFAULT 'active' NOT NULL,
	"cadence" jsonb DEFAULT '{"value":30,"unit":"day"}'::jsonb NOT NULL,
	"grace" jsonb DEFAULT '{"value":14,"unit":"day"}'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[{"offsetHours":0,"channels":["push","email"]},{"offsetHours":72,"channels":["push","email"]},{"offsetHours":168,"channels":["push","email"]}]'::jsonb NOT NULL,
	"warning_phone" varchar(32),
	"last_checkin_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_deadline" timestamp with time zone NOT NULL,
	"armed_at" timestamp with time zone,
	"fired_at" timestamp with time zone,
	"disarmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lastward_public_pages" ADD CONSTRAINT "lastward_public_pages_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_public_pages" ADD CONSTRAINT "lastward_public_pages_action_id_lastward_switch_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."lastward_switch_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_release_tokens" ADD CONSTRAINT "lastward_release_tokens_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_release_tokens" ADD CONSTRAINT "lastward_release_tokens_recipient_id_lastward_switch_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."lastward_switch_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_switch_actions" ADD CONSTRAINT "lastward_switch_actions_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_switch_deliveries" ADD CONSTRAINT "lastward_switch_deliveries_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_switch_payloads" ADD CONSTRAINT "lastward_switch_payloads_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_switch_payloads" ADD CONSTRAINT "lastward_switch_payloads_action_id_lastward_switch_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."lastward_switch_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lastward_switch_recipients" ADD CONSTRAINT "lastward_switch_recipients_switch_id_lastward_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."lastward_switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lastward_public_pages_switch_idx" ON "lastward_public_pages" USING btree ("switch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lastward_public_pages_action_uniq" ON "lastward_public_pages" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "lastward_release_tokens_switch_idx" ON "lastward_release_tokens" USING btree ("switch_id");--> statement-breakpoint
CREATE INDEX "lastward_actions_switch_idx" ON "lastward_switch_actions" USING btree ("switch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lastward_switch_deliveries_unique_idx" ON "lastward_switch_deliveries" USING btree ("switch_id","kind","step_key");--> statement-breakpoint
CREATE INDEX "lastward_payloads_switch_idx" ON "lastward_switch_payloads" USING btree ("switch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lastward_payloads_action_uniq" ON "lastward_switch_payloads" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "lastward_recipients_switch_idx" ON "lastward_switch_recipients" USING btree ("switch_id");--> statement-breakpoint
CREATE INDEX "lastward_switches_deadline_idx" ON "lastward_switches" USING btree ("next_deadline");--> statement-breakpoint
CREATE INDEX "lastward_switches_state_idx" ON "lastward_switches" USING btree ("state");