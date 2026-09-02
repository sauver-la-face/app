'use client';

import type { Dictionary } from '@/i18n/dictionaries';
import { useExportDownload } from '../hooks/useExportDownload';

/**
 * Export CSV de tous les patients, anonymise cote backend : prenom, nom et date
 * de naissance en sont retires (EXPORT-01). C'est ce qui le rend partageable,
 * et c'est aussi pourquoi il vit sur le repertoire et non sur un dossier
 * individuel — il n'a de sens qu'agrege.
 */
export function CsvExportButton({ labels }: { labels: Dictionary['exports'] }) {
  const { download, pending, failed } = useExportDownload();
  const path = '/exports/patients.csv';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => download(path, `patients-anonymized-${today}.csv`)}
        disabled={pending !== null}
        className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending === path ? labels.preparing : labels.downloadCsv}
      </button>
      <p className="text-xs text-gray-500">{labels.csvHint}</p>
      {failed ? <p className="text-xs text-red-600">{labels.error}</p> : null}
    </div>
  );
}
