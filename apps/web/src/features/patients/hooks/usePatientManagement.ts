'use client';

import type { PatientAccessCode } from '@sauver-la-face/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertOk } from '@/lib/apiError';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// La creation de patient vit dans `useCreatePatient.ts`, appelee par la page
// dediee /patients/new. Un second hook du meme nom existait ici, pour le
// formulaire de la page liste : deux chemins pour une meme action, qui
// divergent tot ou tard. Le formulaire ayant ete retire, ce hook l'a suivi.
async function issuePatientAccessCode(patientId: string): Promise<PatientAccessCode> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/access-code`, {
    method: 'POST',
    credentials: 'include',
  });

  await assertOk(response, 'PATIENT_CODE_ISSUE_FAILED');

  return response.json() as Promise<PatientAccessCode>;
}

export function useIssuePatientAccessCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: issuePatientAccessCode,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
