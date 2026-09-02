'use client';

import type { Dictionary } from '@/i18n/dictionaries';
import { useExportDownload } from '../hooks/useExportDownload';

/**
 * WEB-04 : le frontend ne genere rien, il declenche et telecharge (EXPORT-01).
 *
 * Un seul format et un seul patient a la fois. Le dossier part tel quel, sans
 * anonymisation : le patient qui exerce son droit d'acces vient chercher ses
 * donnees medicales, pas une version expurgee. L'export CSV anonymise du
 * backend sert un autre besoin, statistique, et n'a rien a faire ici.
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

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => download(pdfPath, `patient-${patientId}.pdf`)}
        disabled={pending !== null}
        className="rounded-full bg-[#178064] px-5 py-3 text-sm font-medium text-white shadow-xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending === pdfPath ? labels.preparing : labels.downloadPdf}
      </button>
      <p className="max-w-xs text-right text-xs text-gray-500">{labels.portabilityHint}</p>
      {failed ? <p className="text-right text-xs text-red-600">{labels.error}</p> : null}
    </div>
  );
}
