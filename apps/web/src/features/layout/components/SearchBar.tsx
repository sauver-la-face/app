'use client';

import { usePathname } from 'next/navigation';

interface SearchBarProps {
  placeholder: string;
}

export function SearchBar({ placeholder }: SearchBarProps) {
  const pathname = usePathname();
  const isNewPatientPage = pathname.endsWith('/patients/new');

  if (!isNewPatientPage) return null;

  return (
    <input
      type="search"
      placeholder={placeholder}
      className="h-[49px] w-full max-w-[600px] rounded-full border border-black/15 bg-[#EBEBEB] px-6 text-sm text-gray-700 placeholder:text-gray-500 shadow-[inset_0px_3px_6px_rgba(0,0,0,0.15)] focus:border-[#2EAC8E] focus:outline-none focus:ring-1 focus:ring-[#2EAC8E]"
    />
  );
}
