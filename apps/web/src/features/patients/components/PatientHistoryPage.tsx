'use client';

import type { ImageLoaderProps } from 'next/image';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { useSession } from '@/lib/authClient';
import { apiBaseUrl, usePatientHistory } from '../hooks/usePatientHistory';

export function PatientHistoryPage({
  locale,
  patientId,
  dictionary,
}: {
  locale: Locale;
  patientId: string;
  dictionary: Dictionary;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const historyQuery = usePatientHistory(patientId);
  const labels = dictionary.patients;

  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace(`/${locale}/login`);
    }
  }, [locale, router, session, sessionPending]);

  if (sessionPending || historyQuery.isPending) {
    return <CenteredState label={labels.loadingHistory} />;
  }

  if (!session) {
    return null;
  }

  if (historyQuery.isError) {
    const isNotFound =
      historyQuery.error instanceof Error && historyQuery.error.message === 'PATIENT_NOT_FOUND';

    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <div className="rounded-[28px] border border-red-100 bg-red-50 p-8 shadow-xs">
          <p className="text-lg font-semibold text-red-700">
            {isNotFound ? labels.patientNotFound : labels.loadingHistory}
          </p>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white"
          >
            {labels.retry}
          </button>
        </div>
      </main>
    );
  }

  if (!historyQuery.data) {
    return <CenteredState label={labels.loadingHistory} />;
  }

  const history = historyQuery.data;
  const patient = history.patient;
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';
  const events = [...history.events].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const photos = [...history.media].sort((left, right) =>
    right.takenAt.localeCompare(left.takenAt),
  );
  const instructions = [...history.instructions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const procedures = [...history.procedures].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const totalSymptoms = history.events.reduce((sum, event) => sum + event.symptoms.length, 0);
  const totalAlertSymptoms = history.events.reduce(
    (sum, event) => sum + event.symptoms.filter((symptom) => symptom.triggersAlert).length,
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#178064]">{labels.historyTitle}</p>
          <h1 className="mt-3 text-4xl font-semibold text-gray-900">{fullName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">{labels.historySubtitle}</p>
        </div>
        <Link
          href={`/${locale}/patients`}
          className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
        >
          {labels.backToPatients}
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={labels.photoCount} value={String(photos.length)} tone="mint" />
        <SummaryCard label={labels.eventCount} value={String(events.length)} tone="sand" />
        <SummaryCard label={labels.symptomCount} value={String(totalSymptoms)} tone="slate" />
        <SummaryCard
          label={labels.alertSymptomCount}
          value={String(totalAlertSymptoms)}
          tone="rose"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title={labels.photosTitle}>
          {photos.length === 0 ? (
            <EmptyState label={labels.noPhotos} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {photos.map((photo) => (
                <article
                  key={photo.mediaId}
                  className="overflow-hidden rounded-[24px] border border-black/10 bg-[#FBFAF6]"
                >
                  <Image
                    loader={passthroughImageLoader}
                    src={`${apiBaseUrl}/photos/${photo.mediaId}`}
                    alt={photo.description ?? `Photo ${photo.mediaId}`}
                    className="h-56 w-full object-cover"
                    width={640}
                    height={448}
                    unoptimized
                  />
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900">
                        {photo.description ?? photo.fileType}
                      </p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">
                        {formatDate(photo.takenAt, locale)}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                      {photo.fileType}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={labels.summaryTitle}>
          <dl className="space-y-4 text-sm">
            <InfoRow
              label={labels.syncLabel}
              value={formatNullableDate(patient.lastSyncedAt, locale)}
            />
            <InfoRow label={labels.regionLabel} value={patient.region ?? '-'} />
            <InfoRow label={labels.sexLabel} value={patient.sex ?? '-'} />
            <InfoRow label={labels.birthdateLabel} value={patient.birthdate ?? '-'} />
          </dl>

          <div className="mt-6 border-t border-black/10 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
              {labels.proceduresTitle}
            </h3>
            <div className="mt-4 space-y-3">
              {procedures.length === 0 ? (
                <EmptyState label={labels.noProcedures} />
              ) : (
                procedures.map((procedure) => (
                  <div
                    key={procedure.procedureId}
                    className="rounded-[20px] border border-black/10 bg-white px-4 py-3"
                  >
                    <p className="font-medium text-gray-900">{procedure.procedureType}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {labels.procedureDate} {procedure.date}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                      {procedure.hospitalName ?? 'CHU'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* La timeline occupe seule la largeur : le panneau « Evolution des
          symptomes » qui tenait la colonne de gauche a ete retire. Il comptait
          les symptomes par evenement, ce que la timeline dit deja en les
          nommant, et un decompte ne mesure aucune severite — deux symptomes ne
          sont pas plus graves qu'un. Le graphique de severite attendu par
          WEB-02 reste a faire : il suppose un niveau de gravite sur la table
          `symptom`, qui n'en porte aujourd'hui qu'un booleen `triggers_alert`. */}
      <section className="mt-8">
        <Panel title={labels.timelineTitle}>
          {events.length === 0 ? (
            <EmptyState label={labels.noEvents} />
          ) : (
            <div className="space-y-4">
              {events.map((event) => {
                const eventPhotos = photos.filter((photo) => photo.eventId === event.eventId);
                const hasAlert = event.symptoms.some((symptom) => symptom.triggersAlert);

                return (
                  <article
                    key={event.eventId}
                    className="rounded-[24px] border border-black/10 bg-white p-5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                          {event.eventType}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-gray-900">
                          {event.eventTitle ?? event.eventType}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          hasAlert ? 'bg-[#FCE2E2] text-[#B24545]' : 'bg-[#E5F5F1] text-[#2E7F69]'
                        }`}
                      >
                        {hasAlert ? labels.alertBadge : labels.okBadge}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600">{event.description ?? '-'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-400">
                      {formatDate(event.createdAt, locale)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.symptoms.map((symptom) => (
                        <span
                          key={`${event.eventId}-${symptom.code}`}
                          className={`rounded-full px-3 py-1 text-xs ${
                            symptom.triggersAlert
                              ? 'bg-[#FBE4D7] text-[#A95A2A]'
                              : 'bg-[#F1EFE8] text-[#5A5A52]'
                          }`}
                        >
                          {symptom.labelFr}
                        </span>
                      ))}
                    </div>

                    {eventPhotos.length > 0 ? (
                      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                        {eventPhotos.map((photo) => (
                          <Image
                            key={photo.mediaId}
                            loader={passthroughImageLoader}
                            src={`${apiBaseUrl}/photos/${photo.mediaId}`}
                            alt={photo.description ?? photo.fileType}
                            className="h-24 w-24 rounded-2xl object-cover"
                            width={96}
                            height={96}
                            unoptimized
                          />
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-8">
        <Panel title={labels.instructionsTitle}>
          {instructions.length === 0 ? (
            <EmptyState label={labels.noInstructions} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {instructions.map((instruction) => (
                <article
                  key={instruction.instructionId}
                  className="rounded-[24px] border border-black/10 bg-[#FBFAF6] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(instruction.createdAt, locale)}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        instruction.acknowledgedAt
                          ? 'bg-[#E5F5F1] text-[#2E7F69]'
                          : 'bg-[#F1EFE8] text-[#6A645A]'
                      }`}
                    >
                      {instruction.acknowledgedAt
                        ? labels.instructionRead
                        : labels.instructionUnread}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-700">{instruction.content}</p>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-black/10 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'mint' | 'sand' | 'slate' | 'rose';
}) {
  const tones = {
    mint: 'bg-[#E3F4EE] text-[#246D59]',
    sand: 'bg-[#F7E9D2] text-[#8A5A1F]',
    slate: 'bg-[#ECEFF3] text-[#44515E]',
    rose: 'bg-[#F9E1E1] text-[#A34747]',
  };

  return (
    <div className={`rounded-[24px] p-5 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-[20px] bg-[#F6F3ED] px-4 py-5 text-sm text-gray-500">{label}</p>;
}

function CenteredState({ label }: { label: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="flex items-center gap-4 rounded-full bg-white px-6 py-4 shadow-xs">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#178064] border-t-transparent" />
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </main>
  );
}

function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatNullableDate(value: string | null, locale: Locale): string {
  return value ? formatDate(value, locale) : '-';
}
