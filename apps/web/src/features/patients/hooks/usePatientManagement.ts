'use client';

import type { CreatePatientInput, PatientAccessCode, PatientDetails } from '@sauver-la-face/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function createPatient(input: CreatePatientInput): Promise<PatientDetails> {
  const response = await fetch(`${apiBaseUrl}/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('PATIENT_CREATE_FAILED');
  }

  return response.json() as Promise<PatientDetails>;
}

async function issuePatientAccessCode(patientId: string): Promise<PatientAccessCode> {
  const response = await fetch(`${apiBaseUrl}/patients/${patientId}/access-code`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('PATIENT_CODE_ISSUE_FAILED');
  }

  return response.json() as Promise<PatientAccessCode>;
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPatient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
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
