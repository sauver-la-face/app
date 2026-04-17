ALTER TABLE "patient" ALTER COLUMN "first_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ALTER COLUMN "last_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "anonymized_at" timestamp with time zone;