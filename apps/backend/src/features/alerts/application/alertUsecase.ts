import type { AlertListResponse } from '@sauver-la-face/shared';
import { logger } from '@shared/logger';
import type { AlertRepository } from '../domain/alertRepository';
import {
  buildSyncOverdueAlerts,
  buildTriggeredSymptomAlerts,
  createAlertsEtag,
  matchesEtag,
  sortAlerts,
} from '../domain/alertsDomain';

interface AlertLogger {
  info(payload: Record<string, unknown>, message: string): void;
}

export interface AlertListResult {
  etag: string;
  notModified: boolean;
  response: AlertListResponse;
}

export class AlertUsecase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly alertLogger: AlertLogger = logger,
    private readonly nowFactory: () => Date = () => new Date(),
  ) {}

  async listAlerts(ifNoneMatch?: string | null): Promise<AlertListResult> {
    const [triggeredSymptomSources, syncOverdueSources] = await Promise.all([
      this.alertRepository.listTriggeredSymptomAlerts(),
      this.alertRepository.listSyncOverdueCandidates(),
    ]);

    const alerts = sortAlerts([
      ...buildTriggeredSymptomAlerts(triggeredSymptomSources),
      ...buildSyncOverdueAlerts(syncOverdueSources, this.nowFactory()),
    ]);
    const etag = createAlertsEtag(alerts);
    const notModified = matchesEtag(ifNoneMatch, etag);

    this.alertLogger.info(
      {
        alertCount: alerts.length,
        notModified,
      },
      'Alerts listed',
    );

    return {
      etag,
      notModified,
      response: { alerts },
    };
  }
}
