'use client';

import type { CreatePatientInput, PatientAccessCode } from '@sauver-la-face/shared';
import { createPatientSchema } from '@sauver-la-face/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { usePhysicianGuard } from '@/features/auth/hooks/usePhysicianGuard';
import { usePatients } from '@/features/dashboard/hooks/useDashboard';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { useCreatePatient, useIssuePatientAccessCode } from '../hooks/usePatientManagement';
import { PatientCodeBadge } from './PatientBadges';

export function PatientManagementPage({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: Dictionary;
}) {
  const { session, isPending: sessionPending } = usePhysicianGuard(locale);
  const patientsQuery = usePatients();
  const createPatientMutation = useCreatePatient();
  const issueCodeMutation = useIssuePatientAccessCode();
  const labels = dictionary.patientManagement;

  const searchParams = useSearchParams();
  // Bandeau de confirmation apres une creation venue de /patients/new.
  // Volontairement sans minuterie : un message qui s'efface tout seul penalise
  // qui lit lentement, detourne le regard ou utilise un lecteur d'ecran
  // (voir docs/accessibilite.md). Il ne porte aucune information exclusive —
  // le patient reste visible dans la liste avec son statut « sans code actif ».
  const [confirmationVisible, setConfirmationVisible] = useState(searchParams.get('cree') === '1');

  const [formError, setFormError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<PatientAccessCode | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const patients = patientsQuery.data?.patients ?? [];
  const activeCodeCount = useMemo(
    () => patients.filter((patient) => patient.patientCodeStatus === 'active').length,
    [patients],
  );
  const missingCodeCount = useMemo(
    () => patients.filter((patient) => patient.patientCodeStatus === 'none').length,
    [patients],
  );

  if (sessionPending || patientsQuery.isPending) {
    return <CenteredState label={dictionary.common.loading} />;
  }

  if (!session) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[#178064]">{labels.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold text-gray-900">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Action principale, placee avant le lien de retour : la creation
              d'un patient a sa propre page et n'etait atteignable depuis cette
              liste que par la sidebar. Fond #178064 et non #2EAC8E :
              docs/accessibilite.md mesure ce dernier a 2.83:1 en texte blanc,
              sous le minimum AA de 4.5:1 exige par WCAG 2.2 (1.4.3).
              #178064 atteint 4.87:1. */}
          <Link
            href={`/${locale}/patients/new`}
            className="rounded-full bg-[#178064] px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:-translate-y-0.5 hover:bg-[#126650] hover:shadow-md"
          >
            {dictionary.newPatient.title}
          </Link>
          <Link
            href={`/${locale}/dashboard`}
            className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {labels.backToDashboard}
          </Link>
        </div>
      </div>

      {confirmationVisible && (
        <div
          role="status"
          className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3"
        >
          <p className="text-sm text-emerald-900">{labels.createdBanner}</p>
          <button
            type="button"
            onClick={() => setConfirmationVisible(false)}
            aria-label={labels.dismissBanner}
            className="shrink-0 rounded px-2 text-lg leading-none text-emerald-800 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            &times;
          </button>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label={labels.totalPatients} value={String(patients.length)} tone="mint" />
        <SummaryCard label={labels.activeCodes} value={String(activeCodeCount)} tone="sand" />
        <SummaryCard label={labels.missingCodes} value={String(missingCodeCount)} tone="slate" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title={labels.createPatientTitle}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              setFormError(null);
              setCopySuccess(false);

              const formData = new FormData(form);
              const payload: CreatePatientInput = {
                firstName: String(formData.get('firstName') ?? ''),
                lastName: String(formData.get('lastName') ?? ''),
                sex: normalizeOptionalValue(formData.get('sex')),
                birthdate: normalizeOptionalValue(formData.get('birthdate')),
                region: normalizeOptionalValue(formData.get('region')),
              };
              const parsed = createPatientSchema.safeParse(payload);

              if (!parsed.success) {
                setFormError(labels.createValidationError);
                return;
              }

              createPatientMutation.mutate(parsed.data, {
                onSuccess: () => {
                  form.reset();
                },
                onError: () => {
                  setFormError(labels.createError);
                },
              });
            }}
          >
            <FormField
              label={labels.firstNameLabel}
              name="firstName"
              placeholder={labels.firstNamePlaceholder}
            />
            <FormField
              label={labels.lastNameLabel}
              name="lastName"
              placeholder={labels.lastNamePlaceholder}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={labels.sexLabel} name="sex" placeholder={labels.sexPlaceholder} />
              <FormField label={labels.birthdateLabel} name="birthdate" type="date" />
            </div>
            <FormField
              label={labels.regionLabel}
              name="region"
              placeholder={labels.regionPlaceholder}
            />

            {formError ? <InlineMessage tone="error" label={formError} /> : null}
            {createPatientMutation.isSuccess ? (
              <InlineMessage tone="success" label={labels.createSuccess} />
            ) : null}

            <button
              type="submit"
              disabled={createPatientMutation.isPending}
              className="mt-2 rounded-full bg-[#178064] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#25866f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createPatientMutation.isPending ? labels.creating : labels.createAction}
            </button>
          </form>
        </Panel>

        <Panel title={labels.generatedCodeTitle}>
          {generatedCode ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#178064]/20 bg-[#EAF7F2] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[#2E7F69]">
                  {labels.generatedCodeLabel}
                </p>
                <p className="mt-3 font-mono text-4xl font-semibold tracking-[0.3em] text-[#1E5A4B]">
                  {generatedCode.code}
                </p>
                <p className="mt-3 text-sm text-[#35695A]">
                  {labels.generatedCodeExpires}{' '}
                  <span className="font-medium">
                    {formatDateTime(generatedCode.expiresAt, locale)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(generatedCode.code).then(() => {
                      setCopySuccess(true);
                    });
                  }}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {copySuccess ? labels.copyDone : labels.copyCode}
                </button>
                <PatientCodeBadge status={generatedCode.status} dictionary={dictionary.dashboard} />
              </div>
            </div>
          ) : (
            <EmptyState label={labels.generatedCodeEmpty} />
          )}
        </Panel>
      </section>

      <section className="mt-8">
        <Panel title={labels.directoryTitle}>
          {patientsQuery.isError ? (
            <div className="space-y-4">
              <InlineMessage tone="error" label={labels.loadError} />
              <button
                type="button"
                onClick={() => patientsQuery.refetch()}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white"
              >
                {dictionary.patients.retry}
              </button>
            </div>
          ) : patients.length === 0 ? (
            <EmptyState label={labels.noPatients} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] text-sm">
                <thead className="border-b border-black/10 text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{labels.colPatient}</th>
                    <th className="px-4 py-3 font-medium">{labels.colRegion}</th>
                    <th className="px-4 py-3 font-medium">{labels.colBirthdate}</th>
                    <th className="px-4 py-3 font-medium">{labels.colCodeStatus}</th>
                    <th className="px-4 py-3 font-medium">{labels.colLastSync}</th>
                    <th className="px-4 py-3 font-medium">{labels.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {patients.map((patient) => {
                    const displayName =
                      patient.firstName || patient.lastName
                        ? [patient.firstName, patient.lastName].filter(Boolean).join(' ')
                        : dictionary.dashboard.anonymous;

                    return (
                      <tr key={patient.patientId}>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{displayName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">
                              {patient.sex ?? labels.notProvided}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {patient.region ?? labels.notProvided}
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {patient.birthdate ?? labels.notProvided}
                        </td>
                        <td className="px-4 py-4">
                          <PatientCodeBadge
                            status={patient.patientCodeStatus}
                            dictionary={dictionary.dashboard}
                          />
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {patient.lastSyncedAt
                            ? formatDateTime(patient.lastSyncedAt, locale)
                            : dictionary.dashboard.statusNeverSynced}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-3">
                            <Link
                              href={`/${locale}/patients/${patient.patientId}`}
                              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-gray-700 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              {labels.viewHistory}
                            </Link>
                            <button
                              type="button"
                              disabled={issueCodeMutation.isPending}
                              onClick={() => {
                                setCopySuccess(false);
                                issueCodeMutation.mutate(patient.patientId, {
                                  onSuccess: (code) => {
                                    setGeneratedCode(code);
                                  },
                                });
                              }}
                              className="rounded-full bg-[#1F2937] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {patient.patientCodeStatus === 'none'
                                ? labels.generateCode
                                : labels.renewCode}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {issueCodeMutation.isError ? (
            <div className="mt-4">
              <InlineMessage tone="error" label={labels.codeError} />
            </div>
          ) : null}
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
  tone: 'mint' | 'sand' | 'slate';
}) {
  const tones = {
    mint: 'bg-[#E3F4EE] text-[#246D59]',
    sand: 'bg-[#F7E9D2] text-[#8A5A1F]',
    slate: 'bg-[#ECEFF3] text-[#44515E]',
  };

  return (
    <div className={`rounded-[24px] p-5 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function FormField({
  label,
  name,
  placeholder,
  type = 'text',
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: 'text' | 'date';
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="rounded-[18px] border border-black/10 bg-[#FBFAF6] px-4 py-3 text-sm text-gray-900 outline-hidden transition focus:border-[#178064] focus:ring-2 focus:ring-[#178064]/15"
      />
    </label>
  );
}

function InlineMessage({ tone, label }: { tone: 'error' | 'success'; label: string }) {
  const styles = {
    error: 'border-red-100 bg-red-50 text-red-700',
    success: 'border-[#178064]/20 bg-[#EAF7F2] text-[#1F6A57]',
  };

  return <p className={`rounded-[18px] border px-4 py-3 text-sm ${styles[tone]}`}>{label}</p>;
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

function normalizeOptionalValue(value: FormDataEntryValue | null): string | null | undefined {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
