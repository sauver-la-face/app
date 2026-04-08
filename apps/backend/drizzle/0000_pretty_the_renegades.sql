CREATE TABLE IF NOT EXISTS "instructions" (
	"uuid_instructions" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_physician" uuid NOT NULL,
	"uuid_medical_procedure" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"uuid_media" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_event" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"taken_at" timestamp NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medical_event" (
	"uuid_event" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_medical_procedure" uuid NOT NULL,
	"uuid_physician" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_title" varchar(200),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"severity" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medical_procedure" (
	"uuid_medical_procedure" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_patient" uuid NOT NULL,
	"procedure_type" varchar(100) NOT NULL,
	"date" date NOT NULL,
	"hospital_name" varchar(200)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patient" (
	"uuid_patient" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"sex" varchar(10),
	"birthdate" date,
	"region" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patient_code" (
	"uuid_patient_code" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_patient" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "physician" (
	"uuid_physician" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone_number" varchar(20),
	"mail" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "physician_mail_unique" UNIQUE("mail")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instructions" ADD CONSTRAINT "instructions_uuid_physician_physician_uuid_physician_fk" FOREIGN KEY ("uuid_physician") REFERENCES "physician"("uuid_physician") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "instructions" ADD CONSTRAINT "instructions_uuid_medical_procedure_medical_procedure_uuid_medical_procedure_fk" FOREIGN KEY ("uuid_medical_procedure") REFERENCES "medical_procedure"("uuid_medical_procedure") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media" ADD CONSTRAINT "media_uuid_event_medical_event_uuid_event_fk" FOREIGN KEY ("uuid_event") REFERENCES "medical_event"("uuid_event") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_event" ADD CONSTRAINT "medical_event_uuid_medical_procedure_medical_procedure_uuid_medical_procedure_fk" FOREIGN KEY ("uuid_medical_procedure") REFERENCES "medical_procedure"("uuid_medical_procedure") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_event" ADD CONSTRAINT "medical_event_uuid_physician_physician_uuid_physician_fk" FOREIGN KEY ("uuid_physician") REFERENCES "physician"("uuid_physician") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_procedure" ADD CONSTRAINT "medical_procedure_uuid_patient_patient_uuid_patient_fk" FOREIGN KEY ("uuid_patient") REFERENCES "patient"("uuid_patient") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patient_code" ADD CONSTRAINT "patient_code_uuid_patient_patient_uuid_patient_fk" FOREIGN KEY ("uuid_patient") REFERENCES "patient"("uuid_patient") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
