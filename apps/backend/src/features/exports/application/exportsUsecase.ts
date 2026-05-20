import {
  ANONYMIZED_CSV_HEADERS,
  anonymizePatientsForCsv,
  buildPortabilityJson,
  type PatientExportData,
  type PortabilityJsonV1,
  serializeCsv,
} from '../domain/exports.domain';
import type { ExportsRepository } from '../domain/exportsRepository';
import type { PdfReportGenerator } from '../domain/pdfReportGenerator';

export class PatientNotFoundForExportError extends Error {
  readonly code = 'PATIENT_NOT_FOUND';

  constructor(patientId: string) {
    super(`Patient ${patientId} not found`);
  }
}

// Orchestration des exports : récupère le dossier patient via le repository,
// délègue la mise en forme au domain (CSV/JSON) ou à un adapter (PDF).
// Aucune règle métier ici — application/ est un chef d'orchestre.
export class ExportsUsecase {
  constructor(
    private readonly exportsRepository: ExportsRepository,
    private readonly pdfReportGenerator: PdfReportGenerator,
    private readonly nowFactory: () => Date = () => new Date(),
  ) {}

  async exportPatientPdf(patientId: string): Promise<Uint8Array> {
    const patient = await this.loadPatientOrThrow(patientId);
    return this.pdfReportGenerator.generatePatientReport(patient);
  }

  async exportAnonymizedCsv(): Promise<string> {
    const patients = await this.exportsRepository.listAllPatientsForExport();
    const anonymizedRows = anonymizePatientsForCsv(patients);
    return serializeCsv(ANONYMIZED_CSV_HEADERS, anonymizedRows);
  }

  async exportPatientJsonPortability(patientId: string): Promise<PortabilityJsonV1> {
    const patient = await this.loadPatientOrThrow(patientId);
    return buildPortabilityJson(patient, this.nowFactory());
  }

  private async loadPatientOrThrow(patientId: string): Promise<PatientExportData> {
    const patient = await this.exportsRepository.findPatientExportById(patientId);
    if (!patient) {
      throw new PatientNotFoundForExportError(patientId);
    }
    return patient;
  }
}
