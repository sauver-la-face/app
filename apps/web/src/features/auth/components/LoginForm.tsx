'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { signIn } from '@/lib/authClient';

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden
    >
      <title>Utilisateur</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden
    >
      <title>Mot de passe</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
        aria-hidden
      >
        <title>Afficher le mot de passe</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-5 w-5"
      aria-hidden
    >
      <title>Masquer le mot de passe</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

export function LoginForm({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = dictionary;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const data = new FormData(e.currentTarget);
    await signIn.email(
      {
        email: data.get('email') as string,
        password: data.get('password') as string,
      },
      {
        onSuccess: () => router.push(`/${locale}`),
        onError: (ctx) => setError(ctx.error.message),
      },
    );

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
          {login.emailLabel}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <UserIcon />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-14 w-full rounded-[5px] border border-black/30 pl-12 pr-4 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]"
            placeholder={login.emailPlaceholder}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
          {login.passwordLabel}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <LockIcon />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="h-14 w-full rounded-[5px] border border-black/30 pl-12 pr-12 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]"
            placeholder={login.passwordPlaceholder}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="h-14 w-full rounded-[10px] bg-[#2EAC8E] text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? login.submitting : login.submit}
        </button>
      </div>
    </form>
  );
}
