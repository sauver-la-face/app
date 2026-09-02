'use client';

import type { AlertListResponse, PatientListResponse } from '@sauver-la-face/shared';
import { useQuery } from '@tanstack/react-query';
import { assertOk } from '@/lib/apiError';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let alertsEtag: string | null = null;
let previousAlerts: AlertListResponse | null = null;

async function fetchPatients(): Promise<PatientListResponse> {
  const res = await fetch(`${API_URL}/patients`, { credentials: 'include' });
  await assertOk(res, 'PATIENTS_FETCH_FAILED');
  return res.json() as Promise<PatientListResponse>;
}

async function fetchAlerts(): Promise<AlertListResponse> {
  const requestHeaders: HeadersInit = alertsEtag ? { 'If-None-Match': alertsEtag } : {};
  const res = await fetch(`${API_URL}/alerts`, { credentials: 'include', headers: requestHeaders });

  const etag = res.headers.get('ETag');
  if (etag) alertsEtag = etag;

  if (res.status === 304 && previousAlerts) return previousAlerts;
  await assertOk(res, 'ALERTS_FETCH_FAILED');

  const data = (await res.json()) as AlertListResponse;
  previousAlerts = data;
  return data;
}

export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: fetchPatients,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30_000,
  });
}
