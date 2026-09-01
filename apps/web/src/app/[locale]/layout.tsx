import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UserGreeting } from '@/features/auth/components/UserGreeting';
import { LocaleSwitcher } from '@/features/i18n/components/LocaleSwitcher';
import { SearchBar } from '@/features/layout/components/SearchBar';
import { isLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  if (!isLocale(params.locale)) {
    return {};
  }

  const dictionary = getDictionary(params.locale);

  return {
    title: dictionary.metadata.title,
    description: dictionary.metadata.description,
  };
}

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;

  const dictionary = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-6 px-8 py-3">
          {/* Logo aligné à gauche */}
          <div className="flex shrink-0 items-center">
            <Image
              src="/logo.jpg"
              alt={dictionary.common.brand}
              width={88}
              height={88}
              className="rounded-lg object-contain"
              priority
            />
          </div>
          {/* Barre de recherche */}
          <div className="flex flex-1 justify-center">
            <SearchBar placeholder={dictionary.common.searchPlaceholder} />
          </div>
          {/* Greeting + LocaleSwitcher */}
          <div className="flex shrink-0 items-center gap-6">
            <LocaleSwitcher currentLocale={locale} label={dictionary.languageSwitcher.label} />
            <UserGreeting />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="bg-[#D9D9D9] px-8 py-6">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-2 px-8">
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
