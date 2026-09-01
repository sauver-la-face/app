'use client';

import { useSession } from '@/lib/authClient';

export function UserGreeting() {
  const { data: session, isPending } = useSession();

  // Le rendu serveur n'a pas de session : sans cet etat d'attente, le serveur
  // produit null et le client le bloc complet des l'hydratation — les deux arbres
  // different et React signale une erreur d'hydratation. Le gabarit garde aussi
  // la place de l'avatar, ce qui evite un saut de mise en page.
  if (isPending) {
    return <div className="h-14 w-14 rounded-full bg-gray-100" aria-hidden="true" />;
  }

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
