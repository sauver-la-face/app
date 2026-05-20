import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { defaultLocale, isLocale } from '@/i18n/config';

export const metadata: Metadata = {
  title: 'Sauver la Face',
  description: 'Healthcare portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const localeHeader = headers().get('x-slf-locale');
  const locale = isLocale(localeHeader) ? localeHeader : defaultLocale;

  return (
    <html lang={locale}>
      <head>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
