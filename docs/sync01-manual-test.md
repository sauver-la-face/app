[← README](../README.md)

# Test manuel SYNC-01

Ce guide permet de valider `SYNC-01` avec une vraie base PostgreSQL et l'endpoint backend `POST /sync`.

## 1. Préparer l'environnement

```bash
bun run docker:up:dev
bun run --cwd apps/backend db:migrate
bun run --cwd apps/backend db:seed:sync01
```

## 2. Lancer le backend

```bash
bun run dev:backend
```

Le backend écoute sur `http://localhost:3001`.

## 3. Jeu de données seedé

Le seed crée ces identifiants stables :

```text
patientId: 11111111-1111-4111-8111-111111111111
eventId: 33333333-3333-4333-8333-333333333333
symptomId: 44444444-4444-4444-8444-444444444444
instructionId: 55555555-5555-4555-8555-555555555555
mediaId: 22222222-2222-4222-8222-222222222222
```

État serveur initial :
- une `medical_event` existe déjà pour le patient
- une `instruction` existe avec `acknowledged_at = null`
- un `media` existe déjà avec `uuidMedia = 22222222-2222-4222-8222-222222222222`

## 4. Test d'un payload normal

Ce payload doit :
- ajouter un symptôme à l'événement
- mettre à jour l'accusé de lecture de l'instruction
- ne pas créer de conflit sur le média existant car il n'est pas renvoyé ici

```bash
curl -X POST http://localhost:3001/sync ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"11111111-1111-4111-8111-111111111111\",\"schemaVersion\":1,\"medicalEventSymptoms\":[{\"uuidEvent\":\"33333333-3333-4333-8333-333333333333\",\"uuidSymptom\":\"44444444-4444-4444-8444-444444444444\"}],\"media\":[],\"instructionAcknowledgements\":[{\"uuidInstructions\":\"55555555-5555-4555-8555-555555555555\",\"acknowledgedAt\":\"2026-04-28T10:05:00.000Z\"}]}"
```

Résultat attendu :
- réponse `200`
- `schemaVersion: 1`
- `serverState.medicalEventSymptoms` contient l'association événement/symptôme
- `serverState.instructionAcknowledgements` contient l'instruction avec la date envoyée

## 5. Test d'un conflit `server-wins`

Ce payload réutilise `mediaId` déjà présent côté serveur, mais avec une autre URL. Le serveur doit garder sa version.

```bash
curl -X POST http://localhost:3001/sync ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"11111111-1111-4111-8111-111111111111\",\"schemaVersion\":1,\"medicalEventSymptoms\":[],\"media\":[{\"uuidMedia\":\"22222222-2222-4222-8222-222222222222\",\"uuidEvent\":\"33333333-3333-4333-8333-333333333333\",\"fileUrl\":\"https://client.example/conflicting-media.jpg\",\"fileType\":\"jpeg\",\"takenAt\":\"2026-04-28T09:00:00.000Z\",\"description\":\"client-conflict\"}],\"instructionAcknowledgements\":[]}"
```

Résultat attendu :
- réponse `200`
- le média renvoyé dans `serverState.media` garde `https://server.example/existing-media.jpg`
- le backend loggue un conflit avec le message `Sync conflict resolved with server-wins`

## 6. Test de version incompatible

```bash
curl -X POST http://localhost:3001/sync ^
  -H "Content-Type: application/json" ^
  -d "{\"patientId\":\"11111111-1111-4111-8111-111111111111\",\"schemaVersion\":3,\"medicalEventSymptoms\":[],\"media\":[],\"instructionAcknowledgements\":[]}"
```

Résultat attendu :
- réponse `409`
- body avec `code: "APP_UPDATE_REQUIRED"`

