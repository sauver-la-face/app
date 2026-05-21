'use client';

import type { PatientDetails } from '@sauver-la-face/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CreatePatientInput {
  firstName: string;
  lastName: string;
  sex?: string | null;
  birthdate?: string | null;
  region?: string | null;
}

async function createPatient(input: CreatePatientInput): Promise<PatientDetails> {
  const res = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { code?: string };
    throw new Error(data.code ?? 'CREATE_PATIENT_FAILED');
  }

  return res.json() as Promise<PatientDetails>;
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
