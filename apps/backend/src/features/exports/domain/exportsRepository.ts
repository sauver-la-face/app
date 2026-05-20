import type { PatientExportData } from './exportsDomain';

// Port (interface) de lecture des données pour les exports.
// L'implémentation Drizzle vit dans `infrastructure/exportsRepository.ts`.
export interface ExportsRepository {
  // Renvoie l'ensemble du dossier patient agrégé (procédures, événements,
  // symptômes, media, instructions) ou `null` si le patient n'existe pas.
  findPatientExportById(patientId: string): Promise<PatientExportData | null>;

  // Renvoie l'ensemble des patients avec leurs agrégats — utilisé pour le
  // CSV anonymisé. Volume cible : 200 patients actifs max (cf. context.md).
  listAllPatientsForExport(): Promise<PatientExportData[]>;
}
