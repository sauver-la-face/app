'use client';

import type { PatientSummary } from '@sauver-la-face/shared';
import type { Dictionary } from '@/i18n/dictionaries';

interface PatientListProps {
  patients: PatientSummary[];
  alertPatientIds: Set<string>;
  dictionary: Dictionary;
}

function StatusBadge({
  syncStatus,
  hasAlert,
  dictionary,
}: {
  syncStatus: PatientSummary['syncStatus'];
  hasAlert: boolean;
  dictionary: Dictionary['dashboard'];
}) {
  if (hasAlert) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        {dictionary.statusAlert}
      </span>
    );
  }
  if (syncStatus === 'offline') {
    return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
        {dictionary.statusOffline}
      </span>
    );
  }
  if (syncStatus === 'never_synced') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        {dictionary.statusNeverSynced}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      {dictionary.statusOk}
    </span>
  );
}

function CodeBadge({
  status,
  dictionary,
}: {
  status: PatientSummary['patientCodeStatus'];
  dictionary: Dictionary['dashboard'];
}) {
  const labels: Record<PatientSummary['patientCodeStatus'], string> = {
    active: dictionary.codeActive,
    expired: dictionary.codeExpired,
    revoked: dictionary.codeRevoked,
    used: dictionary.codeUsed,
    none: dictionary.codeNone,
  };
  const colors: Record<PatientSummary['patientCodeStatus'], string> = {
    active: 'bg-[#2EAC8E]/10 text-[#2EAC8E]',
    expired: 'bg-yellow-100 text-yellow-800',
    revoked: 'bg-red-100 text-red-800',
    used: 'bg-blue-100 text-blue-800',
    none: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatLastSync(lastSyncedAt: string | null, neverSyncedLabel: string): string {
  if (!lastSyncedAt) return neverSyncedLabel;
  return new Date(lastSyncedAt).toLocaleDateString();
}

export function PatientList({ patients, alertPatientIds, dictionary }: PatientListProps) {
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
                <td className="px-4 py-3 font-medium text-gray-900">{displayName}</td>
                <td className="px-4 py-3 text-gray-500">{patient.region ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    syncStatus={patient.syncStatus}
                    hasAlert={alertPatientIds.has(patient.patientId)}
                    dictionary={dashboard}
                  />
                </td>
                <td className="px-4 py-3">
                  <CodeBadge status={patient.patientCodeStatus} dictionary={dashboard} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatLastSync(patient.lastSyncedAt, dashboard.statusNeverSynced)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
