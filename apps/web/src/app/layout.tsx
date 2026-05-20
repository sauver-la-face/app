import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { defaultLocale, isLocale } from '@/i18n/config';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sauver la Face',
  description: 'Healthcare portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const localeHeader = headers().get('x-slf-locale');
  const locale = isLocale(localeHeader) ? localeHeader : defaultLocale;

  return (
    <html lang={locale}>
      <body className="bg-white text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
