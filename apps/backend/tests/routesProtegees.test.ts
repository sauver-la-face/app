import { afterEach, describe, expect, test } from 'bun:test';
import { createApp } from '../src/index';

// SEC-04/A01 — inventaire des routes.
//
// Ce test ne lit aucune liste ecrite a la main : il parcourt `app.routes`, la
// table de routage reelle de l'application montee en entier. C'est ce qui
// manquait a SEC-01, dont le perimetre etait une enumeration de routeurs — et
// `alertRouter` comme `authRouter` n'y figuraient pas.
//
// Deux proprietes comptent :
//
// 1. Le defaut est le refus. Une route absente de PUBLIQUES fait echouer le
//    test tant que personne ne l'a classee. On ne peut plus oublier par
//    omission, seulement decider explicitement.
// 2. L'application est montee en entier. C'est le seul niveau ou les
//    recouvrements entre routeurs sont visibles — celui qui avait masque
//    GET /patients/{id}/instructions derriere le garde medecin jusqu'a SEC-03.

// Les seules routes qui doivent repondre sans identifiants. Toute addition ici
// est une decision de securite : elle se justifie en revue, pas en passant.
const PUBLIQUES = new Set([
  // Le login patient lui-meme : il ne peut pas exiger d'etre deja authentifie.
  // Protege par le rate limiting (3 tentatives / 15 min par IP), pas par un garde.
  'POST /auth/patient/validate',
  // Documentation d'API : servie uniquement hors production (cf. apiDocs.test.ts).
  'GET /docs',
  'GET /openapi.json',
  // Sonde d'etat, sans donnee metier.
  'GET /health',
]);

// Les routes declarent leurs parametres en `:param` ; on les remplace par des
// valeurs bien formees pour que la requete atteigne la couche
// d'authentification au lieu d'echouer sur la validation du chemin.
const UUID = '11111111-1111-4111-8111-111111111111';

function concretise(chemin: string): string {
  return chemin.replace(/:[A-Za-z]+/g, UUID).replace(/\/\*$/, '');
}

afterEach(() => {
  delete process.env.NODE_ENV;
});

describe('SEC-04 — toute route est protegee ou explicitement publique', () => {
  test('inventaire complet de la table de routage', async () => {
    process.env.NODE_ENV = 'test';
    const app = createApp();

    // Hono enregistre aussi les middlewares dans `routes` (handler `[middleware]`)
    // et une entree fourre-tout `ALL /*`. On ne garde que les vrais handlers.
    const routes = app.routes.filter(
      (route) => route.method !== 'ALL' && !route.path.includes('*'),
    );

    expect(routes.length).toBeGreaterThan(0);

    const nonProtegees: string[] = [];

    for (const route of routes) {
      const cle = `${route.method} ${route.path}`;
      if (PUBLIQUES.has(cle)) continue;

      const response = await app.request(concretise(route.path), {
        method: route.method,
        headers: { 'content-type': 'application/json' },
        body: route.method === 'GET' || route.method === 'HEAD' ? undefined : '{}',
      });

      // 401 attendu : aucun identifiant fourni. Un 4xx de validation (400/404)
      // signifie que la requete a franchi l'authentification — donc qu'il n'y
      // en avait pas.
      if (response.status !== 401) {
        nonProtegees.push(`${cle} -> ${response.status}`);
      }
    }

    expect(nonProtegees).toEqual([]);
  });
});
