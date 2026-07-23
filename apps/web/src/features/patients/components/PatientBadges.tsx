'use client';

import type { PatientCodeStatus, PatientSyncStatus } from '@sauver-la-face/shared';
import type { Dictionary } from '@/i18n/dictionaries';

export function PatientStatusBadge({
  syncStatus,
  hasAlert,
  dictionary,
}: {
  syncStatus: PatientSyncStatus;
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

export function PatientCodeBadge({
  status,
  dictionary,
}: {
  status: PatientCodeStatus;
  dictionary: Dictionary['dashboard'];
}) {
  const labels: Record<PatientCodeStatus, string> = {
    active: dictionary.codeActive,
    expired: dictionary.codeExpired,
    revoked: dictionary.codeRevoked,
    used: dictionary.codeUsed,
    none: dictionary.codeNone,
  };

  const colors: Record<PatientCodeStatus, string> = {
    active: 'bg-[#178064]/10 text-[#178064]',
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
