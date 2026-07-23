import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';

import { createDb, type DbClient } from '../src/shared/db';
import { patient, patientCode } from '../src/infrastructure/schema';
import {
  PgPatientsRepository,
  type PatientPersistenceRecord,
} from '../src/features/patients/infrastructure/patientRepository';

// Nécessite TEST_DATABASE_URL — pointe vers une base Postgres dédiée aux tests
// (jamais la base de dev : les tables sont vidées avant chaque test).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('PgPatientsRepository (integration)', () => {
  let db: DbClient;
  let repository: PgPatientsRepository;

  beforeAll(() => {
    db = createDb(testDatabaseUrl as string);
    repository = new PgPatientsRepository(db);
  });

  beforeEach(async () => {
    await db.delete(patientCode);
    await db.delete(patient);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  const newPatient: Omit<PatientPersistenceRecord, 'patientId'> = {
    firstName: 'Sok',
    lastName: 'Chan',
    sex: 'F',
    birthdate: '1990-03-12',
    region: 'Phnom Penh',
    anonymizedAt: null,
    lastSyncedAt: null,
  };

  it("crée un patient et le relit depuis Postgres", async () => {
    const created = await repository.create(newPatient);

    const found = await repository.findById(created.patientId);

    expect(found?.firstName).toBe('Sok');
    expect(found?.lastName).toBe('Chan');
    expect(found?.birthdate).toBe('1990-03-12');
  });

  it('retourne null pour un patient inexistant', async () => {
    const found = await repository.findById('99999999-9999-4999-8999-999999999999');

    expect(found).toBeNull();
  });

  it("refuse de créer un code d'accès pour un patient inexistant", async () => {
    const created = await repository.createAccessCode(
      '99999999-9999-4999-8999-999999999999',
      'ABC123',
      new Date(),
    );

    expect(created).toBe(false);
  });

  it("s'appuie sur la contrainte unique réelle de Postgres pour refuser un code actif dupliqué", async () => {
    const patientA = await repository.create(newPatient);
    const patientB = await repository.create({ ...newPatient, firstName: 'Dara' });

    const firstCodeCreated = await repository.createAccessCode(
      patientA.patientId,
      'ABC123',
      new Date(),
    );
    // Même code, patient différent : bloqué par l'index unique partiel
    // "patient_code_code_active_unique" (deleted_at IS NULL AND revoked_at IS NULL),
    // pas par une vérification applicative — impossible à couvrir avec un mock.
    const duplicateCodeCreated = await repository.createAccessCode(
      patientB.patientId,
      'ABC123',
      new Date(),
    );

    expect(firstCodeCreated).toBe(true);
    expect(duplicateCodeCreated).toBe(false);
  });

  it("autorise un nouveau code une fois l'ancien révoqué", async () => {
    const createdPatient = await repository.create(newPatient);
    await repository.createAccessCode(createdPatient.patientId, 'ABC123', new Date());

    await repository.revokeActiveCodes(createdPatient.patientId, new Date());
    const recreated = await repository.createAccessCode(
      createdPatient.patientId,
      'XYZ789',
      new Date(),
    );

    expect(recreated).toBe(true);
  });
});
