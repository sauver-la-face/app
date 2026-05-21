'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import { signOut, useSession } from '@/lib/authClient';
import { useAlerts, usePatients } from '../hooks/useDashboard';
import { AlertBanner } from './AlertBanner';
import { PatientList } from './PatientList';

interface DashboardPageProps {
  locale: string;
  dictionary: Dictionary;
}

export function DashboardPage({ locale, dictionary }: DashboardPageProps) {
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();

  const { data: patientsData, isPending: patientsPending } = usePatients();
  const { data: alertsData, isPending: alertsPending } = useAlerts();

  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace(`/${locale}/login`);
    }
  }, [sessionPending, session, router, locale]);

  const alertPatientIds = useMemo(
    () => new Set((alertsData?.alerts ?? []).map((a) => a.patientId)),
    [alertsData],
  );

  if (sessionPending || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-gray-400">{dictionary.common.loading}</span>
      </div>
    );
  }

  const isLoading = patientsPending || alertsPending;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{dictionary.dashboard.title}</h1>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/patients`}
              className="rounded-md border border-[#2EAC8E]/20 bg-[#EAF7F2] px-3 py-1.5 text-sm font-medium text-[#1F6A57] hover:bg-[#def2ea]"
            >
              {dictionary.patientManagement.title}
            </Link>
            <span className="text-sm text-gray-500">
              {dictionary.dashboard.signedInAs}{' '}
              <span className="font-medium text-gray-700">
                {session.user.name ?? dictionary.dashboard.fallbackUserName}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                signOut().then(() => {
                  router.push(`/${locale}/login`);
                })
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {dictionary.common.logout}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400">{dictionary.common.loading}</span>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="mb-3 text-base font-medium text-gray-700">
                {dictionary.dashboard.alertsSection}
              </h2>
              <AlertBanner alerts={alertsData?.alerts ?? []} dictionary={dictionary} />
            </section>

            <section>
              <h2 className="mb-3 text-base font-medium text-gray-700">
                {dictionary.dashboard.patients}
              </h2>
              <PatientList
                patients={patientsData?.patients ?? []}
                alertPatientIds={alertPatientIds}
                dictionary={dictionary}
                locale={locale}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
