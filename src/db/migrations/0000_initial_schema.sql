CREATE TYPE "public"."chat_type" AS ENUM('private', 'group', 'supergroup', 'channel');--> statement-breakpoint
CREATE TYPE "public"."route_status" AS ENUM('active', 'paused', 'removed', 'blocked', 'no_rights', 'not_admin', 'gone', 'deactivated', 'is_bot', 'never_messaged');--> statement-breakpoint
CREATE TABLE "bots" (
	"bot_id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"username" text,
	"type" "chat_type" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_stats" (
	"route_id" uuid PRIMARY KEY NOT NULL,
	"forwarded" bigint DEFAULT 0 NOT NULL,
	"last_forwarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bot_id" bigint NOT NULL,
	"source_chat_id" bigint NOT NULL,
	"dest_chat_id" bigint NOT NULL,
	"status" "route_status" DEFAULT 'active' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_bot_source_dest_key" UNIQUE("bot_id","source_chat_id","dest_chat_id"),
	CONSTRAINT "routes_no_self_forward_check" CHECK ("routes"."source_chat_id" <> "routes"."dest_chat_id")
);
--> statement-breakpoint
ALTER TABLE "route_stats" ADD CONSTRAINT "route_stats_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("bot_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_source_chat_id_fkey" FOREIGN KEY ("source_chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_dest_chat_id_fkey" FOREIGN KEY ("dest_chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routes_bot_id_source_chat_id_idx" ON "routes" USING btree ("bot_id","source_chat_id") WHERE "routes"."status" = 'active';