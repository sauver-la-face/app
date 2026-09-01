import { describe, expect, mock, test } from 'bun:test';

import { PatientUsecase } from '../src/features/patients/application/patientUsecase';
import { InMemoryPatientsRepository } from '../src/features/patients/infrastructure/patientRepository';

const now = new Date('2026-08-31T12:00:00.000Z');

function build() {
  const repository = new InMemoryPatientsRepository();
  const logger = { info: mock(() => undefined), warn: mock(() => undefined) };
  let prochainCode = 100000;
  const usecase = new PatientUsecase(
    repository,
    logger,
    () => now,
    () => String(prochainCode++),
  );
  return { repository, usecase };
}

async function patientAvecSessionOuverte(
  repository: InMemoryPatientsRepository,
  usecase: PatientUsecase,
) {
  const patient = await usecase.createPatient({
    firstName: 'Sok',
    lastName: 'Chan',
    sex: 'F',
    birthdate: '1990-03-12',
    region: 'Phnom Penh',
  });
  const emis = await usecase.issueAccessCode(patient.patientId);
  // Le patient s'est connecte : c'est authUsecase qui pose used_at en
  // production, on le simule ici.
  repository.markCodeUsed(patient.patientId, new Date('2026-08-31T10:00:00.000Z'));
  return { patientId: patient.patientId, code: emis.code };
}

describe('SEC-03 — revocation de session patient', () => {
  test('revoque le code consomme qui porte la session', async () => {
    const { repository, usecase } = build();
    const { patientId } = await patientAvecSessionOuverte(repository, usecase);

    await usecase.revokeSession(patientId);

    const patient = await repository.findById(patientId);
    expect(patient?.latestCode?.revokedAt).toEqual(now);
  });

  test('ne touche pas a la session dun autre patient', async () => {
    const { repository, usecase } = build();
    const cible = await patientAvecSessionOuverte(repository, usecase);
    const autre = await patientAvecSessionOuverte(repository, usecase);

    await usecase.revokeSession(cible.patientId);

    const epargne = await repository.findById(autre.patientId);
    expect(epargne?.latestCode?.revokedAt).toBeNull();
  });

  test('issueAccessCode ne revoque toujours que les codes en attente', async () => {
    const { repository, usecase } = build();
    const { patientId } = await patientAvecSessionOuverte(repository, usecase);

    // Emettre un nouveau code ne doit PAS couper la session en cours : c'est
    // le role de revokeSession, et confondre les deux ferait deconnecter un
    // patient a chaque code regenere.
    await usecase.issueAccessCode(patientId);

    const codes = repository.debugCodes(patientId);
    const consomme = codes.find((code) => code.usedAt !== null);
    expect(consomme?.revokedAt).toBeNull();
  });

  test('un code deja consomme nest jamais reattribue apres revocation', async () => {
    const { repository, usecase } = build();
    const patient = await usecase.createPatient({
      firstName: 'Dara',
      lastName: 'Meas',
      sex: 'M',
      birthdate: '1985-01-01',
      region: 'Kandal',
    });
    await usecase.issueAccessCode(patient.patientId);
    repository.markCodeUsed(patient.patientId, new Date('2026-08-31T10:00:00.000Z'));
    const consomme = repository.debugCodes(patient.patientId)[0];
    await usecase.revokeSession(patient.patientId);

    // Meme revoques, les six chiffres d'un code ayant servi restent hors
    // circulation : ADR 0019.
    const reattribue = await repository.createAccessCode(
      patient.patientId,
      consomme.code,
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(reattribue).toBe(false);
  });

  test('refuse de revoquer la session dun patient inconnu', async () => {
    const { usecase } = build();

    await expect(usecase.revokeSession('00000000-0000-4000-8000-000000000000')).rejects.toThrow();
  });
});
