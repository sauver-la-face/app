'use client';

import type { Dictionary } from '@/i18n/dictionaries';
import { useExportDownload } from '../hooks/useExportDownload';

/**
 * WEB-04 : le frontend ne genere rien, il declenche et telecharge (EXPORT-01).
 *
 * Deux formats sont proposes cote dossier patient parce qu'ils ne servent pas
 * la meme obligation : le PDF est le rapport lisible qu'un medecin remet ou
 * archive, le JSON est le droit a la portabilite du RGPD — des donnees brutes
 * reutilisables, que le patient peut exiger a tout moment.
 */
export function PatientExportButtons({
  patientId,
  labels,
}: {
  patientId: string;
  labels: Dictionary['exports'];
}) {
  const { download, pending, failed } = useExportDownload();
  const pdfPath = `/exports/patients/${patientId}/pdf`;
  const jsonPath = `/exports/patients/${patientId}/json`;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download(pdfPath, `patient-${patientId}.pdf`)}
          disabled={pending !== null}
          className="rounded-full bg-[#178064] px-5 py-3 text-sm font-medium text-white shadow-xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === pdfPath ? labels.preparing : labels.downloadPdf}
        </button>
        <button
          type="button"
          onClick={() => download(jsonPath, `patient-${patientId}-portability.json`)}
          disabled={pending !== null}
          className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === jsonPath ? labels.preparing : labels.downloadJson}
        </button>
      </div>
      <p className="max-w-xs text-right text-xs text-gray-500">{labels.portabilityHint}</p>
      {failed ? <p className="text-right text-xs text-red-600">{labels.error}</p> : null}
    </div>
  );
}
