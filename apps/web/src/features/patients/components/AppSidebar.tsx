'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Dictionary } from '@/i18n/dictionaries';

interface AppSidebarProps {
  locale: string;
  dictionary: Dictionary;
}

const IconGrid = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path strokeLinecap="round" d="M3 9h18" />
    <path strokeLinecap="round" d="M3 14h18" />
    <path strokeLinecap="round" d="M9 9v11" />
  </svg>
);

const IconPerson = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM4 20c0-3.866 3.582-7 8-7s8 3.134 8 7H4z" />
  </svg>
);

const IconGear = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export function AppSidebar({ locale, dictionary }: AppSidebarProps) {
  const pathname = usePathname();
  const labels = dictionary.sidebar;

  const topItems = [
    { label: labels.patients, href: `/${locale}`, icon: <IconGrid /> },
    { label: labels.alerts, href: `/${locale}/avis`, icon: <IconPerson /> },
  ];

  const settingsHref = `/${locale}/parametres`;
  const newPatientHref = `/${locale}/patients/new`;

  return (
    <nav className="flex w-48 shrink-0 flex-col border-r border-black/10 bg-white px-3 py-6">
      {/* Nav principale */}
      <ul className="flex-1 space-y-1">
        {topItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#E5F5F1] text-[#2EAC8E]' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={isActive ? 'text-[#2EAC8E]' : 'text-gray-800'}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bas de sidebar : Paramètres + Nouveau patient */}
      <div className="space-y-2 border-t border-black/10 pt-4">
        <Link
          href={settingsHref}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname === settingsHref ? 'bg-[#E5F5F1] text-[#2EAC8E]' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className={pathname === settingsHref ? 'text-[#2EAC8E]' : 'text-gray-400'}>
            <IconGear />
          </span>
          {labels.settings}
        </Link>

        <Link
          href={newPatientHref}
          className={`flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold text-white transition-colors ${
            pathname === newPatientHref ? 'bg-[#27967A]' : 'bg-[#2EAC8E] hover:bg-[#27967A]'
          }`}
        >
          {labels.newPatient}
        </Link>
      </div>
    </nav>
  );
}
