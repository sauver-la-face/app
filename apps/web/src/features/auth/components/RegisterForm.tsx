'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { authClient } from '@/lib/authClient';

export function RegisterForm({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register } = dictionary;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const data = new FormData(e.currentTarget);
    const password = data.get('password') as string;
    const confirm = data.get('confirm') as string;

    if (password !== confirm) {
      setError(register.passwordMismatch);
      return;
    }

    setLoading(true);

    await authClient.signUp.email(
      {
        name: data.get('name') as string,
        email: data.get('email') as string,
        password,
      },
      {
        onSuccess: () => router.push(`/${locale}/dashboard`),
        onError: (ctx) => setError(ctx.error.message),
      },
    );

    setLoading(false);
  }

  const inputClass =
    'h-9 w-full rounded-[5px] border border-black/30 px-3 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#178064] focus:outline-hidden focus:ring-1 focus:ring-[#178064]';

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label htmlFor="name" className="mb-1 block text-xs font-medium text-gray-700">
          {register.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className={inputClass}
          placeholder={register.namePlaceholder}
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-700">
          {register.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder={register.emailPlaceholder}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-700">
          {register.passwordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className={inputClass}
          placeholder={register.passwordPlaceholder}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-xs font-medium text-gray-700">
          {register.confirmLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className={inputClass}
          placeholder={register.confirmPlaceholder}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="h-9 w-full rounded-[10px] bg-[#178064] text-sm font-medium text-white shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? register.submitting : register.submit}
        </button>
      </div>
    </form>
  );
}
