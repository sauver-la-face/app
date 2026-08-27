import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/LoginForm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function LoginPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const dictionary = getDictionary(params.locale);
  const { common, login } = dictionary;

  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <div className="my-auto mx-auto w-full max-w-[440px]">
        <div className="rounded-[20px] border border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
          <div className="px-8 pb-3 pt-4">
            <h1 className="text-xl font-normal text-gray-900">{login.title}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{login.eyebrow}</p>
          </div>
          <div className="border-t border-black/20" />
          <div className="px-8 py-4">
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

        <div className="mt-3 text-center text-sm text-gray-600">
          {login.registerPrompt}{' '}
          <Link href={`/${params.locale}/register`} className="underline hover:text-gray-900">
            {login.registerLink}
          </Link>
        </div>

        <p className="mt-2 text-center text-xs text-gray-500">{common.protectedAccess}</p>
      </div>
    </main>
  );
}
