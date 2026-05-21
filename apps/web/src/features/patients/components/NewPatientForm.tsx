'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import { useSession } from '@/lib/authClient';
import { useCreatePatient } from '../hooks/useCreatePatient';

interface NewPatientFormProps {
  locale: string;
  dictionary: Dictionary;
}

export function NewPatientForm({ locale, dictionary }: NewPatientFormProps) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const labels = dictionary.newPatient;
  const { mutate, isPending, isError } = useCreatePatient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    if (!sessionPending && !session) {
      router.replace(`/${locale}/login`);
    }
  }, [sessionPending, session, router, locale]);

  if (sessionPending || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-gray-400">{dictionary.common.loading}</span>
      </div>
    );
  }

  const age = birthdate ? calculateAge(birthdate) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(
      {
        firstName,
        lastName,
        sex: sex || null,
        birthdate: birthdate || null,
        region: region || null,
      },
      {
        onSuccess: () => {
          router.push(`/${locale}`);
        },
      },
    );
  }

  const inputClass =
    'h-14 w-full rounded-[5px] border border-black/30 px-4 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]';
  const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700';

  return (
    <div className="flex gap-8">
      <form onSubmit={handleSubmit} className="flex-1 space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">{labels.title}</h1>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="firstName">
              {labels.firstNameLabel} <span className="text-[#2EAC8E]">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              required
              maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lastName">
              {labels.lastNameLabel} <span className="text-[#2EAC8E]">*</span>
            </label>
            <input
              id="lastName"
              type="text"
              required
              maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="birthdate">
              {labels.birthdateLabel}
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
              value={age !== null && age >= 0 ? `${age} ${labels.ageUnit}` : ''}
              className={`${inputClass} cursor-default bg-gray-50 text-gray-500`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="sex">
              {labels.sexLabel}
            </label>
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              <option value="M">{labels.sexMale}</option>
              <option value="F">{labels.sexFemale}</option>
              <option value="Autre">{labels.sexOther}</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="region">
            {labels.regionLabel}
          </label>
          <input
            id="region"
            type="text"
            maxLength={100}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder={labels.regionPlaceholder}
            className={inputClass}
          />
        </div>

        {isError && (
          <p className="rounded-[5px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {labels.errorMessage}
          </p>
        )}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/${locale}`)}
            className="h-14 flex-1 rounded-[10px] border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {labels.cancelButton}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-14 flex-1 rounded-[10px] bg-[#2EAC8E] text-sm font-medium text-white hover:bg-[#27967A] disabled:opacity-60"
          >
            {isPending ? labels.submitting : labels.submitButton}
          </button>
        </div>
      </form>

      <aside className="w-72 shrink-0 space-y-5">
        <div className="rounded-[14px] border border-[#2EAC8E]/20 bg-[#F0FAF7] p-5">
          <h3 className="text-sm font-semibold text-[#2EAC8E]">{labels.asideTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{labels.asideText}</p>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700">{labels.summaryTitle}</h3>
          {firstName || lastName ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-400">{labels.identityLabel}</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {[firstName, lastName].filter(Boolean).join(' ')}
                </dd>
              </div>
              {birthdate ? (
                <div>
                  <dt className="text-xs text-gray-400">{labels.birthdateLabel}</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {birthdate}
                    {age !== null && age >= 0 ? ` (${age} ${labels.ageUnit})` : ''}
                  </dd>
                </div>
              ) : null}
              {sex ? (
                <div>
                  <dt className="text-xs text-gray-400">{labels.sexLabel}</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {sex === 'M' ? labels.sexMale : sex === 'F' ? labels.sexFemale : labels.sexOther}
                  </dd>
                </div>
              ) : null}
              {region ? (
                <div>
                  <dt className="text-xs text-gray-400">{labels.regionLabel}</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{region}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-400">{labels.summaryEmpty}</p>
          )}
        </div>
      </aside>
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
