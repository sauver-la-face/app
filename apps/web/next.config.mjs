import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racineMonorepo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memoise automatiquement les composants a la compilation : plus besoin de
  // placer useMemo / useCallback / React.memo a la main pour eviter les
  // rendus inutiles. Stable depuis Next 16 (React Compiler 1.0).
  //
  // Le compilateur s'appuie sur Babel : le build est plus lent (mesure sur ce
  // projet dans la description de la PR PERF-01).
  reactCompiler: true,

  // DEVOPS-12 : produit `.next/standalone`, un serveur autonome accompagne des
  // seules dependances reellement atteintes par le code. L'image de production
  // n'embarque plus node_modules en entier.
  //
  // `next start` continue de fonctionner a l'identique en local : cette option
  // ajoute une sortie, elle n'en remplace aucune.
  output: 'standalone',

  // Sans cette racine, le tracage des fichiers s'arrete au dossier de l'app et
  // manque les dependances hissees a la racine du monorepo ainsi que le package
  // workspace @sauver-la-face/shared — le serveur autonome demarre alors sur un
  // module introuvable.
  outputFileTracingRoot: racineMonorepo,
};

export default nextConfig;
