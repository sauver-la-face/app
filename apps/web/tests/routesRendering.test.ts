import { beforeAll, describe, expect, test } from 'bun:test';

// Tests de rendu HTTP : les routes sont interrogees telles que Next les sert
// reellement, sur un serveur de production deja demarre.
//
// Pourquoi ce niveau de test plutot que des tests de composants : le contrat
// entre Next et une page — les props `params`, asynchrones depuis Next 16 —
// n'est verifie par aucun outil. Verifie experimentalement en reintroduisant la
// regression : `tsc` passe, `next build` compile, et /en/login rend alors du
// francais au lieu de l'anglais. Un test de composant ne verrait rien non plus,
// puisque le composant recoit sa locale en prop et fonctionne correctement.
//
// Le serveur n'est volontairement pas demarre ici : le piloter depuis le test
// laisse des processus orphelins (tuer le parent ne tue pas `next start`) et
// peut interroger un serveur etranger, donc produire un faux vert. Le job CI
// s'en charge, et le garde-fou ci-dessous echoue explicitement si rien n'ecoute.
//
// Local :
//   bun run --cwd apps/web build
//   bun run --cwd apps/web start &
//   bun run --cwd apps/web test

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

beforeAll(async () => {
  try {
    await fetch(BASE, { redirect: 'manual' });
  } catch {
    throw new Error(
      `Aucun serveur n'ecoute sur ${BASE}. Demarrez-le avant les tests :\n` +
        `  bun run --cwd apps/web build\n` +
        `  bun run --cwd apps/web start\n` +
        `Ou definissez WEB_BASE_URL pour cibler une autre adresse.`,
    );
  }
});

describe('routage par locale', () => {
  test('/ redirige vers la locale par defaut', async () => {
    const response = await fetch(BASE, { redirect: 'manual' });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/fr');
  });

  test('une locale inconnue ne renvoie pas 200', async () => {
    const response = await fetch(`${BASE}/zz/login`, { redirect: 'manual' });

    expect(response.status).not.toBe(200);
  });
});

describe('transmission de params aux pages', () => {
  // Assertion centrale. `getDictionary` retombe silencieusement sur le francais
  // quand la locale est absente :
  //   return (dictionaries[locale] ?? dictionaries[defaultLocale])
  // Si `params` cessait d'etre correctement transmis — signature redevenue
  // synchrone, par exemple — /en/login rendrait du francais. C'est exactement ce
  // qui se produit, et rien d'autre que ce test ne le signale.
  test('/fr/login rend le dictionnaire francais', async () => {
    const html = await (await fetch(`${BASE}/fr/login`)).text();

    expect(html).toContain('Connexion');
    expect(html).toContain('Adresse e-mail');
  });

  test('/en/login rend l anglais, pas le fallback francais', async () => {
    const html = await (await fetch(`${BASE}/en/login`)).text();

    expect(html).toContain('Sign in');
    expect(html).toContain('Email address');
    expect(html).not.toContain('Adresse e-mail');
  });

  test('/fr/register rend le dictionnaire francais', async () => {
    const html = await (await fetch(`${BASE}/fr/register`)).text();

    expect(html).toContain('Creer un compte');
    expect(html).toContain('Nom complet');
  });
});

describe('disponibilite des routes', () => {
  const routes = [
    '/fr',
    '/fr/dashboard',
    '/fr/login',
    '/fr/patients',
    '/fr/register',
    '/en/login',
    '/km/login',
  ];

  for (const route of routes) {
    test(`${route} repond 200 et rend du HTML`, async () => {
      const response = await fetch(`${BASE}${route}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  }
});
