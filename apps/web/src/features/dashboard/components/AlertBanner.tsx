'use client';

import type { Alert } from '@sauver-la-face/shared';
import type { Dictionary } from '@/i18n/dictionaries';

interface AlertBannerProps {
  alerts: Alert[];
  dictionary: Dictionary;
}

export function AlertBanner({ alerts, dictionary }: AlertBannerProps) {
  const { dashboard } = dictionary;

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {dashboard.noAlerts}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50">
      <div className="border-b border-red-100 px-4 py-3 text-sm font-medium text-red-800">
        {dashboard.alertsSection} ({alerts.length})
      </div>
      <ul>
        {alerts.map((alert) => (
          <li
            // Un patient peut declarer plusieurs symptomes declencheurs dans le
            // meme releve : patient, horodatage et type sont alors identiques, et
            // la cle se dedoublait — React omettait silencieusement une alerte.
            // symptomCode les distingue.
            key={`${alert.patientId}-${alert.occurredAt}-${alert.type}-${alert.symptomCode ?? ''}`}
            className="flex items-start gap-3 px-4 py-3 not-last:border-b not-last:border-red-100"
          >
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {alert.patientDisplayName}
              </p>
              <p className="text-sm text-gray-600">{alert.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
