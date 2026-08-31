-- SEC-03/A07 — revocation de session patient.
--
-- Etend l'unicite des codes patient aux codes deja consommes. Le predicat
-- precedent etait `deleted_at IS NULL AND revoked_at IS NULL` : poser
-- revoked_at sur un code consomme le faisait donc sortir de l'index et
-- liberait ses six chiffres. Reattribues a un autre patient, deux lignes
-- portaient le meme code et findByCode en renvoyait une indeterminee — le
-- nouveau patient pouvait se voir refuser un code parfaitement valide.
--
-- Un code ayant servi reste desormais hors circulation, revoque ou non,
-- conformement a l'ADR 0019.
--
-- Ecrite a la main plutot que generee : `drizzle-kit generate` embarque une
-- derive preexistante du snapshot (0004 a ete ecrite a la main sans le
-- regenerer), et produisait un ADD COLUMN last_synced_at qui echouerait sur
-- toute base deja migree, plus un DROP INDEX sans rapport avec SEC-03.
DROP INDEX "patient_code_code_active_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "patient_code_code_active_unique" ON "patient_code" USING btree ("code") WHERE used_at IS NOT NULL OR (deleted_at IS NULL AND revoked_at IS NULL);
