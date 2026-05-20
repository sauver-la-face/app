// Domain pur de la feature EXPORT-01.
// - Types DTO agrégés patient pour les 3 exports (PDF / CSV / JSON)
// - Règles d'anonymisation RGPD pour le CSV
// - Sérialisation CSV (RFC 4180)
// - Structure du JSON de portabilité (RGPD art. 20)
//
// Aucune dépendance externe (ni Drizzle, ni Hono, ni pdf-lib).

export interface ProcedureExportData {
  procedureId: string;
  procedureType: string;
  date: string; // ISO date (YYYY-MM-DD)
  hospitalName: string | null;
}

export interface SymptomExportData {
  code: string;
  labelFr: string;
  labelKm: string;
  triggersAlert: boolean;
}

export interface EventExportData {
  eventId: string;
  procedureId: string;
  physicianId: string | null;
  eventType: string;
  eventTitle: string | null;
  description: string | null;
  createdAt: string; // ISO datetime
  symptoms: SymptomExportData[];
}

export interface MediaExportData {
  mediaId: string;
  eventId: string;
  fileUrl: string;
  fileType: string;
  takenAt: string;
  description: string | null;
}

export interface InstructionExportData {
  instructionId: string;
  procedureId: string;
  physicianId: string;
  content: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface PatientExportData {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthdate: string | null; // ISO date
  region: string | null;
  anonymizedAt: string | null;
  lastSyncedAt: string | null;
  procedures: ProcedureExportData[];
  events: EventExportData[];
  media: MediaExportData[];
  instructions: InstructionExportData[];
}

// Ligne CSV anonymisée — pas de first_name / last_name / birthdate (RGPD).
// On expose un agrégat par patient pour minimiser la réidentification.
export interface AnonymizedPatientRow {
  patientId: string;
  sex: string | null;
  region: string | null;
  anonymizedAt: string | null;
  lastSyncedAt: string | null;
  proceduresCount: number;
  eventsCount: number;
  alertEventsCount: number;
}

export const ANONYMIZED_CSV_HEADERS = [
  'patient_id',
  'sex',
  'region',
  'anonymized_at',
  'last_synced_at',
  'procedures_count',
  'events_count',
  'alert_events_count',
] as const satisfies readonly string[];

export const PORTABILITY_JSON_SCHEMA = 'sauver-la-face/portability/v1' as const;

export interface PortabilityJsonV1 {
  $schema: typeof PORTABILITY_JSON_SCHEMA;
  generatedAt: string;
  patient: PatientExportData;
}

// Retire les PII (first_name, last_name, birthdate) et produit un agrégat
// par patient. `description` libre des événements est aussi écartée — risque
// de réidentification via texte libre.
export function anonymizePatientsForCsv(
  patients: readonly PatientExportData[],
): AnonymizedPatientRow[] {
  return patients.map((patient) => ({
    patientId: patient.patientId,
    sex: patient.sex,
    region: patient.region,
    anonymizedAt: patient.anonymizedAt,
    lastSyncedAt: patient.lastSyncedAt,
    proceduresCount: patient.procedures.length,
    eventsCount: patient.events.length,
    alertEventsCount: patient.events.filter((event) =>
      event.symptoms.some((symptom) => symptom.triggersAlert),
    ).length,
  }));
}

// Sérialisation CSV RFC 4180 : séparateur virgule, terminateur CRLF, échappement
// des champs contenant virgule, guillemet ou newline par double-quote.
export function serializeCsv(
  headers: readonly string[],
  rows: readonly AnonymizedPatientRow[],
): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    [
      row.patientId,
      row.sex,
      row.region,
      row.anonymizedAt,
      row.lastSyncedAt,
      row.proceduresCount,
      row.eventsCount,
      row.alertEventsCount,
    ]
      .map(csvEscape)
      .join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Construit la réponse JSON de portabilité (RGPD art. 20). Données brutes
// complètes du patient, sans transformation — c'est le droit d'export.
export function buildPortabilityJson(patient: PatientExportData, now: Date): PortabilityJsonV1 {
  return {
    $schema: PORTABILITY_JSON_SCHEMA,
    generatedAt: now.toISOString(),
    patient,
  };
}

// Affichage défensif des champs PII : si patient anonymisé (RGPD art. 17),
// les colonnes BDD sont déjà NULL — on affiche un placeholder pour le PDF.
export function displayPii(value: string | null, isAnonymized: boolean): string {
  if (isAnonymized) {
    return '[Anonymisé]';
  }
  return value ?? '';
}
