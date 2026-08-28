/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memoise automatiquement les composants a la compilation : plus besoin de
  // placer useMemo / useCallback / React.memo a la main pour eviter les
  // rendus inutiles. Stable depuis Next 16 (React Compiler 1.0).
  //
  // Le compilateur s'appuie sur Babel : le build est plus lent (mesure sur ce
  // projet dans la description de la PR PERF-01).
  reactCompiler: true,
};

export default nextConfig;
