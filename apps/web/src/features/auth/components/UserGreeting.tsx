'use client';

import { useSession } from '@/lib/authClient';

export function UserGreeting() {
  const { data: session } = useSession();

  if (!session) return null;

  const name = session.user.name ?? session.user.email;
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2EAC8E] text-base font-semibold text-white">
        {initials}
      </div>
      <div className="text-sm leading-tight">
        <p className="text-gray-500">Bonjour</p>
        <p className="font-semibold text-gray-900">{name}</p>
      </div>
    </div>
  );
}
