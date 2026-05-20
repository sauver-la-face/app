import { describe, expect, it } from 'bun:test';

import {
  ANONYMIZED_CSV_HEADERS,
  anonymizePatientsForCsv,
  buildPortabilityJson,
  displayPii,
  type PatientExportData,
  PORTABILITY_JSON_SCHEMA,
  serializeCsv,
} from './exports.domain';

function buildPatient(overrides: Partial<PatientExportData> = {}): PatientExportData {
  return {
    patientId: '11111111-1111-4111-8111-111111111111',
    firstName: 'Sokha',
    lastName: 'Chan',
    sex: 'F',
    birthdate: '1990-04-12',
    region: 'Phnom Penh',
    anonymizedAt: null,
    lastSyncedAt: '2026-05-19T10:00:00.000Z',
    procedures: [],
    events: [],
    media: [],
    instructions: [],
    ...overrides,
  };
}

describe('anonymizePatientsForCsv', () => {
  it('retire les PII (first_name, last_name, birthdate) de chaque ligne', () => {
    const rows = anonymizePatientsForCsv([buildPatient()]);

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).not.toHaveProperty('firstName');
    expect(row).not.toHaveProperty('lastName');
    expect(row).not.toHaveProperty('birthdate');
    expect(row.sex).toBe('F');
    expect(row.region).toBe('Phnom Penh');
  });

  it('compte le nombre de procedures, événements et événements avec alerte', () => {
    const rows = anonymizePatientsForCsv([
      buildPatient({
        procedures: [
          {
            procedureId: 'p-1',
            procedureType: 'cleft-lip',
            date: '2026-01-10',
            hospitalName: null,
          },
        ],
        events: [
          {
            eventId: 'e-1',
            procedureId: 'p-1',
            physicianId: null,
            eventType: 'follow-up',
            eventTitle: null,
            description: null,
            createdAt: '2026-01-15T00:00:00.000Z',
            symptoms: [
              { code: 'pain_mild', labelFr: 'Douleur', labelKm: 'ឈឺ', triggersAlert: false },
            ],
          },
          {
            eventId: 'e-2',
            procedureId: 'p-1',
            physicianId: null,
            eventType: 'follow-up',
            eventTitle: null,
            description: null,
            createdAt: '2026-02-15T00:00:00.000Z',
            symptoms: [
              { code: 'bleeding', labelFr: 'Saignement', labelKm: 'ឈាម', triggersAlert: true },
            ],
          },
        ],
      }),
    ]);

    const row = rows[0]!;
    expect(row.proceduresCount).toBe(1);
    expect(row.eventsCount).toBe(2);
    expect(row.alertEventsCount).toBe(1);
  });
});

describe('serializeCsv', () => {
  it('produit une ligne d en-tête puis une ligne par patient, séparées par CRLF', () => {
    const csv = serializeCsv(ANONYMIZED_CSV_HEADERS, [
      {
        patientId: 'a',
        sex: 'F',
        region: 'Phnom Penh',
        anonymizedAt: null,
        lastSyncedAt: null,
        proceduresCount: 0,
        eventsCount: 0,
        alertEventsCount: 0,
      },
    ]);

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'patient_id,sex,region,anonymized_at,last_synced_at,procedures_count,events_count,alert_events_count',
    );
    expect(lines[1]).toBe('a,F,Phnom Penh,,,0,0,0');
  });

  it('échappe les valeurs contenant virgule, guillemet ou newline (RFC 4180)', () => {
    const csv = serializeCsv(ANONYMIZED_CSV_HEADERS, [
      {
        patientId: 'a',
        sex: 'F',
        region: 'Region, "Special"',
        anonymizedAt: null,
        lastSyncedAt: null,
        proceduresCount: 0,
        eventsCount: 0,
        alertEventsCount: 0,
      },
    ]);

    const dataLine = csv.split('\r\n')[1]!;
    expect(dataLine).toContain('"Region, ""Special"""');
  });

  it('ne contient jamais les colonnes PII dans le header', () => {
    const headerLine = serializeCsv(ANONYMIZED_CSV_HEADERS, []);
    expect(headerLine).not.toContain('first_name');
    expect(headerLine).not.toContain('last_name');
    expect(headerLine).not.toContain('birthdate');
  });
});

describe('buildPortabilityJson', () => {
  it('produit un document versionné avec le patient brut intact', () => {
    const patient = buildPatient();
    const now = new Date('2026-05-20T12:00:00.000Z');

    const document = buildPortabilityJson(patient, now);

    expect(document.$schema).toBe(PORTABILITY_JSON_SCHEMA);
    expect(document.generatedAt).toBe('2026-05-20T12:00:00.000Z');
    // Données brutes complètes (RGPD art. 20 — droit à la portabilité) :
    // les PII sont conservées dans le JSON puisqu'il est destiné au patient.
    expect(document.patient.firstName).toBe('Sokha');
    expect(document.patient.lastName).toBe('Chan');
    expect(document.patient.birthdate).toBe('1990-04-12');
  });
});

describe('displayPii', () => {
  it("retourne le placeholder '[Anonymisé]' si le patient est anonymisé", () => {
    expect(displayPii(null, true)).toBe('[Anonymisé]');
    // Même si la valeur n'est pas null pour une raison quelconque, on masque.
    expect(displayPii('Chan', true)).toBe('[Anonymisé]');
  });

  it('retourne la valeur ou une chaîne vide si patient non anonymisé', () => {
    expect(displayPii('Sokha', false)).toBe('Sokha');
    expect(displayPii(null, false)).toBe('');
  });
});
