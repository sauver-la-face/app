-- AUTH-03 — Better Auth 1.7.
--
-- Cette migration remplace les 0006_yielding_fallen_one et 0007_lonely_medusa
-- generees avant DEVOPS-10 : leur numerotation entrait en collision avec la
-- 0006_resynchroniser_snapshot, et leurs snapshots, construits sur un schema
-- anterieur, ne declaraient pas `patient_code_uuid_patient_idx`.
--
-- L'ordre suit la procedure du guide d'upgrade : colonne nullable, backfill,
-- verification des collisions, puis contrainte et index unique.
-- https://better-auth.com/docs/guides/1-7-upgrade-guide

-- 1. `account.issuer` : l'identite d'un compte est desormais cadree par
-- l'emetteur. L'adaptateur Drizzle exige ce champ depuis 1.7 ; sans lui, toute
-- inscription echoue en 500 (BetterAuthError sur le modele "account").
--
-- Ajout nullable et non `ADD COLUMN ... NOT NULL`, qui echouerait sur toute
-- table `account` deja peuplee.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint

-- 2. Backfill. `authConfig.ts` n'active que `emailAndPassword` : toutes les
-- lignes existantes sont des comptes credential, dont l'emetteur est
-- `local:credential` selon le tableau du guide d'upgrade.
UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential' AND "issuer" IS NULL;--> statement-breakpoint

-- 3. Collisions. L'index unique de l'etape 5 echouerait de lui-meme sur un
-- doublon, mais sur une violation de contrainte illisible en sortie de
-- migration. Ce controle nomme le probleme et s'arrete avant d'avoir rien
-- modifie de plus.
--
-- Une collision se resout a la main, jamais automatiquement : si les lignes
-- appartiennent au meme medecin, il faut les reconcilier puis supprimer les
-- doublons ; si elles pointent des medecins differents, il faut etablir le
-- proprietaire reel a partir des donnees du fournisseur — pas de l'email.
DO $$
DECLARE
  doublons integer;
BEGIN
  SELECT count(*) INTO doublons
  FROM (
    SELECT 1 FROM "account" GROUP BY "issuer", "account_id" HAVING count(*) > 1
  ) AS collisions;

  IF doublons > 0 THEN
    RAISE EXCEPTION 'AUTH-03 : % couples (issuer, account_id) en double dans "account". Les resoudre avant de rejouer cette migration (guide Better Auth 1.7, section Collisions and Constraints).', doublons;
  END IF;
END
$$;--> statement-breakpoint

-- 4. Emetteurs non couverts. L'etape 2 est volontairement sans clause de repli :
-- une ligne portant un autre `provider_id` reste NULL. C'est l'effet recherche —
-- cela signifie qu'un fournisseur a ete ajoute sans que son emetteur de
-- confiance soit decide ici, et `issuer` est une donnee d'identite : mieux vaut
-- echouer que l'inventer. Le `SET NOT NULL` de l'etape 5 s'en chargerait, mais
-- sur un « contains null values » qui ne dit pas quoi corriger.
DO $$
DECLARE
  fournisseurs text;
BEGIN
  SELECT string_agg(DISTINCT "provider_id", ', ') INTO fournisseurs
  FROM "account" WHERE "issuer" IS NULL;

  IF fournisseurs IS NOT NULL THEN
    RAISE EXCEPTION 'AUTH-03 : aucun emetteur defini pour le(s) provider_id suivant(s) : %. Completer l''etape 2 de cette migration avec leur emetteur de confiance (guide Better Auth 1.7, tableau Backfill the account identity).', fournisseurs;
  END IF;
END
$$;--> statement-breakpoint

-- 5. Contrainte.
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint

-- 6. L'identite d'un compte est le couple (issuer, account_id). L'unicite est
-- ce qui donne son sens au cadrage par emetteur : sans elle, deux lignes
-- pourraient revendiquer la meme identite chez le meme emetteur.
CREATE UNIQUE INDEX "account_issuer_account_id_unique" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint

-- 7. `two_factor` : protection contre le forcage brutal du code TOTP. Le
-- compteur d'echecs et la date de deverrouillage sont ecrits par le plugin ;
-- leur absence fait echouer l'enrolement en 500.
ALTER TABLE "two_factor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "locked_until" timestamp with time zone;
