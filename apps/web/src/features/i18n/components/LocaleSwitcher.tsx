'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { type Locale, localeConfig, locales } from '@/i18n/config';

function localizePathname(pathname: string, locale: Locale): string {
  const segments = pathname.split('/');
  if (segments.length > 1) segments[1] = locale;
  return segments.join('/') || `/${locale}`;
}

export function LocaleSwitcher({ currentLocale, label }: { currentLocale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [open, setOpen] = useState(false);

  const current = localeConfig[currentLocale];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-black/20 bg-white px-3 py-2 shadow-xs transition-shadow hover:shadow-md"
        aria-label={`${label}: ${current.label}`}
        aria-expanded={open}
      >
        <Image
          src={current.flag}
          alt={current.label}
          width={28}
          height={20}
          className="rounded-xs object-cover"
        />
        <svg
          className={`h-3 w-3 text-black/60 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden
        >
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute right-0 z-20 mt-1 w-full overflow-hidden rounded-lg border border-black/20 bg-white shadow-md">
            {locales.map((locale) => {
              const href = `${localizePathname(pathname, locale)}${query ? `?${query}` : ''}`;
              const isActive = locale === currentLocale;
              return (
                <li key={locale}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-50 ${
                      isActive ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    <Image
                      src={localeConfig[locale].flag}
                      alt={localeConfig[locale].label}
                      width={28}
                      height={20}
                      className="rounded-xs object-cover"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
