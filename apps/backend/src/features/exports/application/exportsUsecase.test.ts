import { describe, expect, it } from 'bun:test';

import { type PatientExportData, PORTABILITY_JSON_SCHEMA } from '../domain/exportsDomain';
import type { ExportsRepository } from '../domain/exportsRepository';
import type { PdfReportGenerator } from '../domain/pdfReportGenerator';
import { PdfLibReportGenerator } from '../infrastructure/pdfLibReportGenerator';
import { ExportsUsecase, PatientNotFoundForExportError } from './exportsUsecase';

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

class InMemoryExportsRepository implements ExportsRepository {
  constructor(private readonly patients: PatientExportData[]) {}

  async findPatientExportById(patientId: string): Promise<PatientExportData | null> {
    return this.patients.find((patient) => patient.patientId === patientId) ?? null;
  }

  async listAllPatientsForExport(): Promise<PatientExportData[]> {
    return [...this.patients];
  }
}

class StubPdfReportGenerator implements PdfReportGenerator {
  calls: PatientExportData[] = [];

  async generatePatientReport(patient: PatientExportData): Promise<Uint8Array> {
    this.calls.push(patient);
    return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
  }
}

describe('ExportsUsecase.exportPatientPdf', () => {
  it('délègue au PdfReportGenerator avec le patient chargé via le repository', async () => {
    const patient = buildPatient();
    const generator = new StubPdfReportGenerator();
    const usecase = new ExportsUsecase(new InMemoryExportsRepository([patient]), generator);

    const bytes = await usecase.exportPatientPdf(patient.patientId);

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.patientId).toBe(patient.patientId);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("lève PatientNotFoundForExportError si le patient n'existe pas", async () => {
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([]),
      new StubPdfReportGenerator(),
    );

    await expect(usecase.exportPatientPdf('22222222-2222-4222-8222-222222222222')).rejects.toThrow(
      PatientNotFoundForExportError,
    );
  });

  it('produit un PDF valide (magic header %PDF-) avec le générateur pdf-lib réel', async () => {
    const patient = buildPatient({
      procedures: [
        {
          procedureId: 'p-1',
          procedureType: 'cleft-lip',
          date: '2026-01-10',
          hospitalName: 'CHU Toulouse',
        },
      ],
    });
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([patient]),
      new PdfLibReportGenerator(),
    );

    const bytes = await usecase.exportPatientPdf(patient.patientId);
    const header = new TextDecoder().decode(bytes.slice(0, 5));

    expect(header).toBe('%PDF-');
  });
});

describe('ExportsUsecase.exportAnonymizedCsv', () => {
  it("produit un CSV contenant la ligne d'en-tête sans PII", async () => {
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([buildPatient()]),
      new StubPdfReportGenerator(),
    );

    const csv = await usecase.exportAnonymizedCsv();
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe(
      'patient_id,sex,region,anonymized_at,last_synced_at,procedures_count,events_count,alert_events_count',
    );
    expect(csv).not.toContain('Sokha');
    expect(csv).not.toContain('Chan');
    expect(csv).not.toContain('1990-04-12');
  });

  it('produit une ligne par patient', async () => {
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([
        buildPatient({ patientId: 'a' }),
        buildPatient({ patientId: 'b' }),
      ]),
      new StubPdfReportGenerator(),
    );

    const lines = (await usecase.exportAnonymizedCsv()).split('\r\n');
    // 1 header + 2 patients = 3 lignes
    expect(lines).toHaveLength(3);
  });
});

describe('ExportsUsecase.exportPatientJsonPortability', () => {
  it('retourne les données brutes complètes du patient (RGPD art. 20)', async () => {
    const patient = buildPatient();
    const fixedNow = new Date('2026-05-20T12:00:00.000Z');
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([patient]),
      new StubPdfReportGenerator(),
      () => fixedNow,
    );

    const document = await usecase.exportPatientJsonPortability(patient.patientId);

    expect(document.$schema).toBe(PORTABILITY_JSON_SCHEMA);
    expect(document.generatedAt).toBe('2026-05-20T12:00:00.000Z');
    expect(document.patient.firstName).toBe('Sokha');
    expect(document.patient.lastName).toBe('Chan');
    expect(document.patient.birthdate).toBe('1990-04-12');
  });

  it("lève PatientNotFoundForExportError si le patient n'existe pas", async () => {
    const usecase = new ExportsUsecase(
      new InMemoryExportsRepository([]),
      new StubPdfReportGenerator(),
    );

    await expect(
      usecase.exportPatientJsonPortability('22222222-2222-4222-8222-222222222222'),
    ).rejects.toThrow(PatientNotFoundForExportError);
  });
});
