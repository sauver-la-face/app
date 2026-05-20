'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut, useSession } from '@/lib/authClient';

export default function HomePage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  const { user } = session;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-lg">
              ✚
            </span>
            <span className="font-semibold text-gray-800">Sauver la Face</span>
          </div>
          <button
            type="button"
            onClick={() =>
              signOut({
                fetchOptions: { onSuccess: () => router.replace('/login') },
              })
            }
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Welcome */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Connecté en tant que</p>
          <h1 className="text-xl font-bold text-gray-900">{user.name ?? 'Médecin'}</h1>
          <p className="text-sm text-blue-600 mt-0.5">{user.email}</p>
        </div>

        {/* Auth info */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatusCard
            label="Session"
            value="Active"
            sub="Expire dans 2h d'inactivité"
            color="green"
          />
          <StatusCard
            label="MFA TOTP"
            value={(user as any).twoFactorEnabled ? 'Activé' : 'Non activé'}
            sub={
              (user as any).twoFactorEnabled
                ? 'Double authentification active'
                : 'Recommandé pour la sécurité'
            }
            color={user.twoFactorEnabled ? 'green' : 'yellow'}
          />
          <StatusCard
            label="Backend"
            value="Better Auth v1"
            sub="Drizzle · PostgreSQL"
            color="blue"
          />
        </div>

        {/* Session details */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Détails de session</h2>
          <dl className="space-y-2 text-sm">
            <Row label="ID utilisateur" value={user.id} mono />
            <Row label="Email vérifié" value={user.emailVerified ? 'Oui' : 'Non'} />
            <Row
              label="Compte créé le"
              value={new Date(user.createdAt).toLocaleDateString('fr-FR', {
                dateStyle: 'long',
              })}
            />
          </dl>
        </div>
      </div>
    </main>
  );
}

function StatusCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: 'green' | 'yellow' | 'blue';
}) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="mt-0.5 text-xs opacity-70">{sub}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <dt className="w-36 shrink-0 text-gray-500">{label}</dt>
      <dd className={`text-gray-800 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</dd>
    </div>
  );
}
