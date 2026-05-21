'use client';

import type { PatientSummary } from '@sauver-la-face/shared';
import Link from 'next/link';
import { PatientCodeBadge, PatientStatusBadge } from '@/features/patients/components/PatientBadges';
import type { Dictionary } from '@/i18n/dictionaries';

interface PatientListProps {
  patients: PatientSummary[];
  alertPatientIds: Set<string>;
  dictionary: Dictionary;
  locale: string;
}

function formatLastSync(lastSyncedAt: string | null, neverSyncedLabel: string): string {
  if (!lastSyncedAt) return neverSyncedLabel;
  return new Date(lastSyncedAt).toLocaleDateString();
}

export function PatientList({ patients, alertPatientIds, dictionary, locale }: PatientListProps) {
  const { dashboard } = dictionary;

  if (patients.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
        {dashboard.noPatients}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{dashboard.colName}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{dashboard.colRegion}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">{dashboard.colStatus}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">
              {dashboard.colCodeStatus}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">
              {dashboard.colLastSync}
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">
              {dictionary.patientManagement.colActions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {patients.map((patient) => {
            const displayName =
              patient.firstName || patient.lastName
                ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
                : dashboard.anonymous;

            return (
              <tr key={patient.patientId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link
                    href={`/${locale}/patients/${patient.patientId}`}
                    className="hover:text-[#2EAC8E] hover:underline"
                  >
                    {displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{patient.region ?? '—'}</td>
                <td className="px-4 py-3">
                  <PatientStatusBadge
                    syncStatus={patient.syncStatus}
                    hasAlert={alertPatientIds.has(patient.patientId)}
                    dictionary={dashboard}
                  />
                </td>
                <td className="px-4 py-3">
                  <PatientCodeBadge status={patient.patientCodeStatus} dictionary={dashboard} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatLastSync(patient.lastSyncedAt, dashboard.statusNeverSynced)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/${locale}/patients/${patient.patientId}`}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {dictionary.patientManagement.viewHistory}
                    </Link>
                    <Link
                      href={`/${locale}/patients`}
                      className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      {dictionary.patientManagement.managePatient}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
