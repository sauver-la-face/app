import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/LoginForm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default function LoginPage({ params }: { params: { locale: Locale } }) {
  const dictionary = getDictionary(params.locale);
  const { common, login } = dictionary;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg">
            +
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{common.brand}</h1>
          <p className="mt-1 text-sm text-gray-500">{login.eyebrow}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">{login.title}</h2>
          <LoginForm locale={params.locale} dictionary={dictionary} />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          {login.registerPrompt}{' '}
          <Link
            href={`/${params.locale}/register`}
            className="font-medium text-blue-600 hover:underline"
          >
            {login.registerLink}
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400">{common.protectedAccess}</p>
      </div>
    </main>
  );
}
