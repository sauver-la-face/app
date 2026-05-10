import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl shadow-lg">
            ✚
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sauver la Face</h1>
          <p className="mt-1 text-sm text-gray-500">Portail médecin — connexion sécurisée</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">Connexion</h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Accès réservé aux professionnels de santé autorisés
        </p>
      </div>
    </main>
  );
}
