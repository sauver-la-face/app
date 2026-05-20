import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocaleSwitcher } from '@/features/i18n/components/LocaleSwitcher';
import { isLocale, type Locale, locales } from '@/i18n/config';

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

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.16),_transparent_60%)]" />
      <div className="relative">
        <div className="mx-auto flex max-w-6xl justify-end px-4 py-4 sm:px-6">
          <LocaleSwitcher currentLocale={locale} />
        </div>
        {children}
      </div>
    </div>
  );
}
