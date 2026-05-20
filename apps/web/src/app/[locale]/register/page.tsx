import Link from 'next/link';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default function RegisterPage({ params }: { params: { locale: Locale } }) {
  const dictionary = getDictionary(params.locale);
  const { common, register } = dictionary;

  return (
    <main className="flex flex-1 flex-col px-4 py-2">
      <div className="my-auto mx-auto w-full max-w-[440px]">
        <div className="rounded-[20px] border border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
          <div className="px-8 pb-2 pt-3">
            <h1 className="text-xl font-normal text-gray-900">{register.title}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{register.eyebrow}</p>
          </div>
          <div className="border-t border-black/20" />
          <div className="px-8 py-3">
            <RegisterForm locale={params.locale} dictionary={dictionary} />
          </div>
        </div>

        <div className="mt-3 text-center text-sm text-gray-600">
          {register.loginPrompt}{' '}
          <Link href={`/${params.locale}/login`} className="underline hover:text-gray-900">
            {register.loginLink}
          </Link>
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">{common.protectedAccess}</p>
      </div>
    </main>
  );
}
