import type { PatientExportData } from './exportsDomain';

// Port (interface) de génération du PDF rapport patient.
// L'implémentation concrète (pdf-lib) vit dans
// `infrastructure/pdfLibReportGenerator.ts`. On garde l'usecase indépendant
// du moteur PDF — règle Clean Architecture : `application/` ne connaît pas
// les libs externes.
export interface PdfReportGenerator {
  generatePatientReport(patient: PatientExportData): Promise<Uint8Array>;
}
