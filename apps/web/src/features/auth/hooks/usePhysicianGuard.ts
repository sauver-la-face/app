'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/authClient';

/**
 * Garde commune aux ecrans reserves aux medecins.
 *
 * Le second facteur est obligatoire cote serveur depuis AUTH-02 : sans lui,
 * toute route patient repond 403 MFA_REQUIRED. Un ecran qui ne verifie que la
 * presence d'une session laisse donc l'utilisateur devant une erreur generique,
 * sans lien vers /mfa/setup — la page existe pourtant et fonctionne.
 *
 * Le garde vivait en double dans DashboardPage ; il est ici pour que chaque
 * ecran protege s'y raccroche au lieu de le reecrire ou de l'oublier.
 */
export function usePhysicianGuard(locale: string) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.replace(`/${locale}/login`);
      return;
    }

    if (!session.user.twoFactorEnabled) {
      router.replace(`/${locale}/mfa/setup`);
    }
  }, [isPending, session, router, locale]);

  return { session, isPending };
}
