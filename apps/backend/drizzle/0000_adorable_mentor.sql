CREATE TABLE "instructions" (
	"uuid_instructions" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_physician" uuid NOT NULL,
	"uuid_medical_procedure" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"uuid_media" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_event" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "medical_event" (
	"uuid_event" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_medical_procedure" uuid NOT NULL,
	"uuid_physician" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_title" varchar(200),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_event_symptom" (
	"uuid_event" uuid NOT NULL,
	"uuid_symptom" uuid NOT NULL,
	CONSTRAINT "medical_event_symptom_uuid_event_uuid_symptom_pk" PRIMARY KEY("uuid_event","uuid_symptom")
);
--> statement-breakpoint
CREATE TABLE "medical_procedure" (
	"uuid_medical_procedure" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_patient" uuid NOT NULL,
	"procedure_type" varchar(100) NOT NULL,
	"date" date NOT NULL,
	"hospital_name" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "patient" (
	"uuid_patient" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"sex" varchar(10),
	"birthdate" date,
	"region" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "patient_code" (
	"uuid_patient_code" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid_patient" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "physician" (
	"uuid_physician" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone_number" varchar(20),
	"mail" varchar(255) NOT NULL,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom" (
	"uuid_symptom" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"label_fr" varchar(100) NOT NULL,
	"label_km" varchar(100) NOT NULL,
	"triggers_alert" boolean DEFAULT false NOT NULL,
	CONSTRAINT "symptom_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_uuid_physician_physician_uuid_physician_fk" FOREIGN KEY ("uuid_physician") REFERENCES "public"."physician"("uuid_physician") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructions" ADD CONSTRAINT "instructions_uuid_medical_procedure_medical_procedure_uuid_medical_procedure_fk" FOREIGN KEY ("uuid_medical_procedure") REFERENCES "public"."medical_procedure"("uuid_medical_procedure") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uuid_event_medical_event_uuid_event_fk" FOREIGN KEY ("uuid_event") REFERENCES "public"."medical_event"("uuid_event") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_event" ADD CONSTRAINT "medical_event_uuid_medical_procedure_medical_procedure_uuid_medical_procedure_fk" FOREIGN KEY ("uuid_medical_procedure") REFERENCES "public"."medical_procedure"("uuid_medical_procedure") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_event" ADD CONSTRAINT "medical_event_uuid_physician_physician_uuid_physician_fk" FOREIGN KEY ("uuid_physician") REFERENCES "public"."physician"("uuid_physician") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_event_symptom" ADD CONSTRAINT "medical_event_symptom_uuid_event_medical_event_uuid_event_fk" FOREIGN KEY ("uuid_event") REFERENCES "public"."medical_event"("uuid_event") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_event_symptom" ADD CONSTRAINT "medical_event_symptom_uuid_symptom_symptom_uuid_symptom_fk" FOREIGN KEY ("uuid_symptom") REFERENCES "public"."symptom"("uuid_symptom") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_procedure" ADD CONSTRAINT "medical_procedure_uuid_patient_patient_uuid_patient_fk" FOREIGN KEY ("uuid_patient") REFERENCES "public"."patient"("uuid_patient") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_code" ADD CONSTRAINT "patient_code_uuid_patient_patient_uuid_patient_fk" FOREIGN KEY ("uuid_patient") REFERENCES "public"."patient"("uuid_patient") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instructions_uuid_physician_idx" ON "instructions" USING btree ("uuid_physician");--> statement-breakpoint
CREATE INDEX "instructions_uuid_medical_procedure_idx" ON "instructions" USING btree ("uuid_medical_procedure");--> statement-breakpoint
CREATE INDEX "media_uuid_event_idx" ON "media" USING btree ("uuid_event");--> statement-breakpoint
CREATE INDEX "medical_event_uuid_medical_procedure_idx" ON "medical_event" USING btree ("uuid_medical_procedure");--> statement-breakpoint
CREATE INDEX "medical_procedure_uuid_patient_idx" ON "medical_procedure" USING btree ("uuid_patient");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_code_code_active_unique" ON "patient_code" USING btree ("code") WHERE deleted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_code_patient_active_unique" ON "patient_code" USING btree ("uuid_patient") WHERE is_active = true AND used_at IS NULL AND deleted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "patient_code_uuid_patient_idx" ON "patient_code" USING btree ("uuid_patient");--> statement-breakpoint
CREATE UNIQUE INDEX "physician_mail_unique" ON "physician" USING btree (lower("mail"));