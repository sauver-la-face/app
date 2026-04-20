DROP INDEX "patient_code_created_at_idx";--> statement-breakpoint
CREATE INDEX "patient_code_created_at_idx" ON "patient_code" USING btree ("created_at") WHERE used_at IS NULL AND deleted_at IS NULL;