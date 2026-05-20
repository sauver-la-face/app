'use client';

import { useQuery } from '@tanstack/react-query';
import type { PatientHistoryResponse } from '@sauver-la-face/shared';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function usePatientHistory(patientId: string) {
  return useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: async (): Promise<PatientHistoryResponse> => {
      const response = await fetch(`${apiBaseUrl}/patients/${patientId}/history`, {
        credentials: 'include',
      });

      if (response.status === 404) {
        throw new Error('PATIENT_NOT_FOUND');
      }

      if (!response.ok) {
        throw new Error('PATIENT_HISTORY_FETCH_FAILED');
      }

      return (await response.json()) as PatientHistoryResponse;
    },
    enabled: patientId.length > 0,
  });
}
