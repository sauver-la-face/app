ALTER TABLE "patient_code" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;
ALTER TABLE "patient_code" ADD CONSTRAINT "patient_code_is_active_chk" CHECK ("is_active" IN (0, 1));