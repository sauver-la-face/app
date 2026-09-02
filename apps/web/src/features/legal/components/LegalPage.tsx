import type { ReactNode } from 'react';

/**
 * Gabarit commun aux trois pages legales. Elles partagent la meme structure —
 * un titre, une date de mise a jour, des sections — et le meme gabarit garantit
 * qu'elles ne divergent pas visuellement au fil des modifications.
 */
export function LegalPage({
  title,
  intro,
  updatedAt,
  children,
}: {
  title: string;
  intro: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">{intro}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-400">{updatedAt}</p>

      <div className="mt-8 space-y-8">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-gray-700">{children}</div>
    </section>
  );
}
