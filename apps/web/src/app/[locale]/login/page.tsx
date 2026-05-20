import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/LoginForm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default function LoginPage({ params }: { params: { locale: Locale } }) {
  const dictionary = getDictionary(params.locale);
  const { common, login } = dictionary;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[685px]">
        <div className="rounded-[20px] border border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
          <div className="px-10 pb-4 pt-6">
            <h1 className="text-2xl font-normal text-gray-900">{login.title}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{login.eyebrow}</p>
          </div>
          <div className="border-t border-black/20" />
          <div className="px-10 py-6">
            <LoginForm locale={params.locale} dictionary={dictionary} />
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            href={`/${params.locale}/forgot-password`}
            className="text-sm text-gray-600 underline hover:text-gray-900"
          >
            {login.forgotPassword}
          </Link>
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">{common.protectedAccess}</p>
      </div>
    </main>
  );
}
