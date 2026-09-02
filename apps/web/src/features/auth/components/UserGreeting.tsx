'use client';

import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/authClient';

// Pages ou l'identite du medecin n'a rien a faire : on y arrive precisement
// pour s'authentifier, ou pour franchir le second facteur. Afficher « Bonjour
// X » au-dessus d'un formulaire de connexion laisse croire que la session est
// perdue alors qu'elle est valide.
const PAGES_SANS_IDENTITE = ['/login', '/register', '/mfa/setup', '/mfa/verify'];

export function UserGreeting() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  if (PAGES_SANS_IDENTITE.some((page) => pathname.endsWith(page))) {
    return null;
  }

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
