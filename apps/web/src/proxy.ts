import { type NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';

const PUBLIC_FILE = /\.[^/]+$/;
const LOCALE_COOKIE = 'slf-locale';
const LOCALE_HEADER = 'x-slf-locale';

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const accepted = request.headers.get('accept-language');

  if (accepted) {
    for (const item of accepted.split(',')) {
      const candidate = item.split(';')[0]?.trim().toLowerCase().split('-')[0];

      if (isLocale(candidate)) {
        return candidate;
      }
    }
  }

  return defaultLocale;
}

function isSecureRequest(request: NextRequest): boolean {
  // Derriere Caddy, la requete arrive en clair : c'est x-forwarded-proto qui
  // porte le schema d'origine. Poser `secure` inconditionnellement ferait
  // refuser le cookie par le navigateur sur toute origine HTTP simple.
  const forwarded = request.headers.get('x-forwarded-proto');

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() === 'https';
  }

  return request.nextUrl.protocol === 'https:';
}

function localeCookieOptions(request: NextRequest) {
  return { path: '/', sameSite: 'lax' as const, secure: isSecureRequest(request) };
}

function extractLocale(pathname: string): Locale | null {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : null;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const locale = extractLocale(pathname);

  if (!locale) {
    const redirectLocale = getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${redirectLocale}${pathname}`;

    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, redirectLocale, localeCookieOptions(request));
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions(request));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
