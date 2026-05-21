'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/i18n/dictionaries';

interface AppSidebarProps {
  locale: string;
  dictionary: Dictionary;
}

export function AppSidebar({ locale, dictionary }: AppSidebarProps) {
  const pathname = usePathname();
  const labels = dictionary.sidebar;

  const navItems = [
    { label: labels.patients, href: `/${locale}` },
    { label: labels.alerts, href: `/${locale}/avis` },
    { label: labels.settings, href: `/${locale}/parametres` },
  ];

  return (
    <nav className="w-52 shrink-0 border-r border-black/10 bg-white px-4 py-8">
      <ul className="space-y-1">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-[#E5F5F1] text-[#2EAC8E]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-black/10 pt-6">
        <Link
          href={`/${locale}/patients/new`}
          className={`flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
            pathname === `/${locale}/patients/new`
              ? 'bg-[#27967A]'
              : 'bg-[#2EAC8E] hover:bg-[#27967A]'
          }`}
        >
          {labels.newPatient}
        </Link>
      </div>
    </nav>
  );
}
