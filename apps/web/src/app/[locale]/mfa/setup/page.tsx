import { MfaSetup } from '@/features/auth/components/MfaSetup';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function MfaSetupPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const dictionary = getDictionary(params.locale);
  const { common, mfa } = dictionary;

  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <div className="my-auto mx-auto w-full max-w-[520px]">
        <div className="rounded-[20px] border border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
          <div className="px-8 pb-3 pt-4">
            <h1 className="text-xl font-normal text-gray-900">{mfa.pageTitle}</h1>
            <p className="mt-0.5 text-xs text-gray-500">{mfa.pageEyebrow}</p>
          </div>
          <div className="border-t border-black/20" />
          <div className="px-8 py-5">
            <MfaSetup locale={params.locale} dictionary={dictionary} />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">{common.protectedAccess}</p>
      </div>
    </main>
  );
}
