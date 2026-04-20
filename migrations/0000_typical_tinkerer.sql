CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text,
	"visitor_name" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"emotion" text,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"visitor_name" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"visitor_id" text,
	"title" varchar(255),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "emotional_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text,
	"emotion" varchar(50) NOT NULL,
	"intensity" integer DEFAULT 50,
	"trigger" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text,
	"fact_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"importance" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "nyla_microstructure_cache" (
	"ca" varchar(42) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nyla_wallet_age" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"first_tx_timestamp" timestamp,
	"age_days" integer NOT NULL,
	"tier" varchar(16) NOT NULL,
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"count" integer DEFAULT 1,
	"window_start" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewers" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"name" text NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0,
	CONSTRAINT "viewers_visitor_id_unique" UNIQUE("visitor_id")
);
--> statement-breakpoint
CREATE TABLE "x_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"reply_to_tweet_id" varchar(50),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"tweet_id" varchar(50),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp
);
