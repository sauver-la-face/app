'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getLocaleLabel, type Locale, locales } from '@/i18n/config';

function localizePathname(pathname: string, locale: Locale): string {
  const segments = pathname.split('/');

  if (segments.length > 1) {
    segments[1] = locale;
  }

  return segments.join('/') || `/${locale}`;
}

export function LocaleSwitcher({ currentLocale, label }: { currentLocale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-2 py-1 text-xs shadow-sm">
      <span className="px-2 text-gray-500">{label}</span>
      {locales.map((locale) => {
        const href = `${localizePathname(pathname, locale)}${query ? `?${query}` : ''}`;
        const isActive = locale === currentLocale;

        return (
          <Link
            key={locale}
            href={href}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {getLocaleLabel(locale)}
          </Link>
        );
      })}
    </div>
  );
}
