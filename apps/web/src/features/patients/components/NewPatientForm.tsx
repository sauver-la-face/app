'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePhysicianGuard } from '@/features/auth/hooks/usePhysicianGuard';
import type { Dictionary } from '@/i18n/dictionaries';
import { useCreatePatient } from '../hooks/useCreatePatient';

interface NewPatientFormProps {
  locale: string;
  dictionary: Dictionary;
}

export function NewPatientForm({ locale, dictionary }: NewPatientFormProps) {
  const router = useRouter();
  const { session, isPending: sessionPending } = usePhysicianGuard(locale);
  const labels = dictionary.newPatient;
  const { mutate, isPending, isError } = useCreatePatient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [city, setCity] = useState('');

  if (sessionPending || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-gray-400">{dictionary.common.loading}</span>
      </div>
    );
  }

  const age = birthdate ? calculateAge(birthdate) : null;
  const hasContent = firstName || lastName;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(
      {
        firstName,
        lastName,
        sex: sex || null,
        birthdate: birthdate || null,
        region: city || null,
      },
      {
        onSuccess: () => {
          // Vers la liste, pas vers la racine : c'est l'ecran qui porte le bouton
          // « Generer le code », et un patient sans code ne sert a rien. Le
          // marqueur declenche le bandeau de confirmation a l'arrivee.
          router.push(`/${locale}/patients?cree=1`);
        },
      },
    );
  }

  const inputClass =
    'h-11 w-full rounded-[5px] border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]';
  const selectClass =
    'h-11 w-full rounded-[5px] border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

  return (
    <div>
      {/* Header titre + boutons — au-dessus du flex row */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{labels.subtitle}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            // Vers le tableau de bord, pas vers /[locale] : cette racine n'est pas
            // une destination mais une page de transit qui redirige vers la
            // connexion. Annuler une creation ramenait donc l'utilisateur sur un
            // ecran vide au lieu de son point de depart.
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {labels.cancelButton}
          </button>
          <button
            type="submit"
            form="new-patient-form"
            disabled={isPending}
            className="rounded-md bg-[#2EAC8E] px-5 py-2 text-sm font-medium text-white hover:bg-[#27967A] disabled:opacity-60"
          >
            {isPending ? labels.submitting : labels.submitButton}
          </button>
        </div>
      </div>

      {/* Flex row : formulaire + aside alignés */}
      <div className="flex gap-6">
        <div className="flex-1">
          <form id="new-patient-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Informations personnelles */}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-gray-800">
                {labels.personalInfoSection}
              </h2>

              {/* Row 1 : Prénom / Nom */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="firstName">
                    {labels.firstNameLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    maxLength={100}
                    placeholder={labels.firstNamePlaceholder}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="lastName">
                    {labels.lastNameLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    maxLength={100}
                    placeholder={labels.lastNamePlaceholder}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Row 2 : Date / Âge / Sexe */}
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} htmlFor="birthdate">
                    {labels.birthdateLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="age">
                    {labels.ageLabel}
                  </label>
                  <input
                    id="age"
                    type="text"
                    readOnly
                    value={age !== null && age >= 0 ? `${age}` : '--'}
                    className={`${inputClass} cursor-default bg-gray-50 text-gray-400`}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="sex">
                    {labels.sexLabel} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">{labels.sexSelect}</option>
                    <option value="M">{labels.sexMale}</option>
                    <option value="F">{labels.sexFemale}</option>
                    <option value="Autre">{labels.sexOther}</option>
                  </select>
                </div>
              </div>

              {/* Row 3 : Ville */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="city">
                    {labels.cityLabel}
                  </label>
                  <input
                    id="city"
                    type="text"
                    maxLength={255}
                    placeholder={labels.cityPlaceholder}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Pièces jointes */}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                  />
                </svg>
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    {labels.attachmentsLabel}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">({labels.attachmentsOptional})</span>
                  <p className="mt-0.5 text-xs text-gray-500">{labels.attachmentsHint}</p>
                </div>
              </div>
            </div>

            {isError && (
              <p className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {labels.errorMessage}
              </p>
            )}
          </form>
        </div>

        {/* Panneau droit */}
        <aside className="w-64 shrink-0 space-y-4">
          {/* À savoir */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-gray-900"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">{labels.asideTitle}</h3>
            </div>
            <p className="text-xs leading-5 text-gray-900">{labels.asideText}</p>
          </div>

          {/* Résumé */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900">{labels.summaryTitle}</h3>
            </div>

            {hasContent ? (
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-gray-400">{labels.identityLabel}</dt>
                  <dd className="mt-0.5 font-medium text-gray-800">
                    {[firstName, lastName].filter(Boolean).join(' ')}
                  </dd>
                </div>
                {birthdate ? (
                  <div>
                    <dt className="text-gray-400">{labels.birthdateLabel}</dt>
                    <dd className="mt-0.5 font-medium text-gray-800">
                      {birthdate}
                      {age !== null && age >= 0 ? ` (${age} ${labels.ageUnit})` : ''}
                    </dd>
                  </div>
                ) : null}
                {sex ? (
                  <div>
                    <dt className="text-gray-400">{labels.sexLabel}</dt>
                    <dd className="mt-0.5 font-medium text-gray-800">
                      {sex === 'M'
                        ? labels.sexMale
                        : sex === 'F'
                          ? labels.sexFemale
                          : labels.sexOther}
                    </dd>
                  </div>
                ) : null}
                {city ? (
                  <div>
                    <dt className="text-gray-400">{labels.cityLabel}</dt>
                    <dd className="mt-0.5 font-medium text-gray-800">{city}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    aria-hidden="true"
                    className="h-6 w-6 text-gray-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                </div>
                <div className="w-full space-y-1.5">
                  <div className="h-2 w-3/4 rounded-full bg-gray-100" />
                  <div className="h-2 w-1/2 rounded-full bg-gray-100" />
                  <div className="h-2 w-2/3 rounded-full bg-gray-100" />
                </div>
                <p className="text-center text-xs text-gray-900">{labels.summaryEmpty}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {/* fin flex gap-6 */}
    </div>
  );
}

function calculateAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
