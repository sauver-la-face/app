import { RegisterForm } from '@/features/auth/components/RegisterForm';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl shadow-lg">
            ✚
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sauver la Face</h1>
          <p className="mt-1 text-sm text-gray-500">Portail médecin — création de compte</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">Créer un compte</h2>
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400">
          Accès réservé aux professionnels de santé autorisés
        </p>
      </div>
    </main>
  );
}
