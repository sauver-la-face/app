export const MFA_REQUIRED = 'MFA_REQUIRED';

/**
 * Le backend renvoie 403 MFA_REQUIRED quand la session est valide mais que le
 * compte n'a pas active son second facteur (physicianAuthMiddleware). Le 403
 * est deliberement distinct du 401 : la session est bonne, c'est le compte qui
 * ne l'est pas, et le client doit orienter vers l'enrolement plutot que vers la
 * connexion.
 *
 * Sans cette lecture, un `!response.ok` indifferencie transforme une consigne
 * actionnable en panne generique : l'utilisateur lit « impossible de charger
 * les patients » la ou il faudrait lui ouvrir la page d'enrolement.
 */
export async function assertOk(response: Response, fallbackCode: string): Promise<void> {
  if (response.ok) return;

  if (response.status === 403) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;

    if (body?.code === MFA_REQUIRED) {
      throw new Error(MFA_REQUIRED);
    }
  }

  throw new Error(fallbackCode);
}
