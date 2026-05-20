import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocaleSwitcher } from '@/features/i18n/components/LocaleSwitcher';
import { isLocale, type Locale, locales } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  if (!isLocale(params.locale)) {
    return {};
  }

  const dictionary = getDictionary(params.locale);

  return {
    title: dictionary.metadata.title,
    description: dictionary.metadata.description,
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;

  const dictionary = getDictionary(locale);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="border-b border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt={dictionary.common.brand}
              width={56}
              height={56}
              className="rounded-lg object-contain"
              priority
            />
            <span className="text-lg font-semibold text-gray-900">{dictionary.common.brand}</span>
          </div>
          <LocaleSwitcher currentLocale={locale} />
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="bg-[#D9D9D9] px-8 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-2">
          <Link
            href={`/${locale}/mentions-legales`}
            className="text-sm text-black underline hover:opacity-70"
          >
            {dictionary.footer.legal}
          </Link>
          <Link
            href={`/${locale}/confidentialite`}
            className="text-sm text-black underline hover:opacity-70"
          >
            {dictionary.footer.privacy}
          </Link>
          <Link
            href={`/${locale}/plan-du-site`}
            className="text-sm text-black underline hover:opacity-70"
          >
            {dictionary.footer.sitemap}
          </Link>
        </div>
      </footer>
    </div>
  );
}
