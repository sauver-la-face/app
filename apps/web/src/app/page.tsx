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

  if (!session) {
    return null;
  }

  const { user } = session;
  const twoFactorEnabled = user.twoFactorEnabled;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg text-white">
              +
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
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Se deconnecter
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="mb-1 text-sm text-gray-500">Connecte en tant que</p>
          <h1 className="text-xl font-bold text-gray-900">{user.name ?? 'Medecin'}</h1>
          <p className="mt-0.5 text-sm text-blue-600">{user.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatusCard
            label="Session"
            value="Active"
            sub="Expire dans 2h d'inactivite"
            color="green"
          />
          <StatusCard
            label="MFA TOTP"
            value={twoFactorEnabled ? 'Activé' : 'Non activé'}
            sub={
              twoFactorEnabled ? 'Double authentification active' : 'Recommande pour la securite'
            }
            color={twoFactorEnabled ? 'green' : 'yellow'}
          />
          <StatusCard
            label="Backend"
            value="Better Auth v1"
            sub="Drizzle · PostgreSQL"
            color="blue"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Details de session</h2>
          <dl className="space-y-2 text-sm">
            <Row label="ID utilisateur" value={user.id} mono />
            <Row label="Email verifie" value={user.emailVerified ? 'Oui' : 'Non'} />
            <Row
              label="Compte cree le"
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
    green: 'border-green-100 bg-green-50 text-green-700',
    yellow: 'border-yellow-100 bg-yellow-50 text-yellow-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
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
      <dd className={`text-gray-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
