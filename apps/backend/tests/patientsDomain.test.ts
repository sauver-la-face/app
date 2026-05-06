import { describe, expect, test } from 'bun:test';

import { Patient } from '../src/features/patients/domain/patient';
import {
  resolvePatientCodeStatus,
  resolvePatientSyncStatus,
} from '../src/features/patients/domain/patient.domain';

const now = new Date('2026-05-06T12:00:00.000Z');

describe('patients.domain', () => {
  test('normalise un patient et refuse les noms vides', () => {
    const patient = Patient.create({
      firstName: '  Sok  ',
      lastName: ' Chan ',
      sex: ' F ',
      birthdate: '1990-03-12',
      region: ' Phnom Penh ',
    });

    expect(patient.firstName).toBe('Sok');
    expect(patient.lastName).toBe('Chan');
    expect(patient.sex).toBe('F');
    expect(patient.region).toBe('Phnom Penh');
    expect(() =>
      Patient.create({
        firstName: ' ',
        lastName: 'Chan',
        sex: null,
        birthdate: null,
        region: null,
      }),
    ).toThrow('PATIENT_FIRST_NAME_REQUIRED');
  });

  test('deduit les statuts de sync et de code', () => {
    expect(resolvePatientSyncStatus(null, now)).toBe('never_synced');
    expect(resolvePatientSyncStatus(new Date('2026-05-05T12:00:00.000Z'), now)).toBe('ok');
    expect(resolvePatientSyncStatus(new Date('2026-04-20T12:00:00.000Z'), now)).toBe('offline');

    expect(resolvePatientCodeStatus(undefined, now)).toBe('none');
    expect(
      resolvePatientCodeStatus(
        {
          createdAt: new Date('2026-05-06T08:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: null,
        },
        now,
      ),
    ).toBe('active');
    expect(
      resolvePatientCodeStatus(
        {
          createdAt: new Date('2026-05-01T08:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: null,
        },
        now,
      ),
    ).toBe('expired');
    expect(
      resolvePatientCodeStatus(
        {
          createdAt: new Date('2026-05-06T08:00:00.000Z'),
          usedAt: new Date('2026-05-06T09:00:00.000Z'),
          deletedAt: null,
          revokedAt: null,
        },
        now,
      ),
    ).toBe('used');
    expect(
      resolvePatientCodeStatus(
        {
          createdAt: new Date('2026-05-06T08:00:00.000Z'),
          usedAt: null,
          deletedAt: null,
          revokedAt: new Date('2026-05-06T10:00:00.000Z'),
        },
        now,
      ),
    ).toBe('revoked');
  });
});
