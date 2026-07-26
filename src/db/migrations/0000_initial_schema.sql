CREATE TABLE "bots" (
	"bot_id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Unnamed chat' NOT NULL,
	"username" text DEFAULT 'unknown' NOT NULL,
	"type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bot_id" bigint NOT NULL,
	"source_chat_id" bigint NOT NULL,
	"dest_chat_id" bigint NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_bot_source_dest_key" UNIQUE("bot_id","source_chat_id","dest_chat_id")
);
--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_bot_id_bots_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("bot_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_source_chat_id_chats_chat_id_fk" FOREIGN KEY ("source_chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_dest_chat_id_chats_chat_id_fk" FOREIGN KEY ("dest_chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routes_lookup_idx" ON "routes" USING btree ("bot_id","source_chat_id") WHERE "routes"."enabled";