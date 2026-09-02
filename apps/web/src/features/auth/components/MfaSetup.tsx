'use client';

import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { twoFactor } from '@/lib/authClient';

/**
 * Extrait la cle base32 de l'URI otpauth renvoyee par Better Auth.
 * Format : otpauth://totp/Emetteur:email?secret=BASE32&issuer=Emetteur
 * On l'affiche telle quelle : sans generateur de QR code embarque, la saisie
 * manuelle dans l'application d'authentification est le seul chemin fiable,
 * et elle evite d'envoyer le secret a un service tiers pour le dessiner.
 */
function extraireSecret(totpUri: string): string | null {
  try {
    return new URL(totpUri).searchParams.get('secret');
  } catch {
    return null;
  }
}

/** Groupe la cle par blocs de 4 pour la rendre lisible a la recopie. */
function formaterSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? [secret]).join(' ');
}

export function MfaSetup({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const router = useRouter();
  const { mfa } = dictionary;

  const [etape, setEtape] = useState<'motDePasse' | 'activation'>('motDePasse');
  const [motDePasse, setMotDePasse] = useState('');
  const [uriTotp, setUriTotp] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [codesDeSecours, setCodesDeSecours] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function demarrerEnrolement(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { data, error } = await twoFactor.enable({ password: motDePasse });

    setEnCours(false);

    if (error || !data) {
      // Ne pas conclure au mot de passe errone sur n'importe quelle erreur :
      // un defaut serveur affichait « mot de passe incorrect » et envoyait
      // l'utilisateur chercher au mauvais endroit.
      setErreur(error?.status === 401 ? mfa.wrongPassword : mfa.genericError);
      return;
    }

    // La reponse est une union discriminee : le plugin sait aussi faire de l'OTP
    // par message, qui ne renvoie ni URI ni codes de secours. Seul le cas TOTP
    // nous interesse ici.
    if (data.method !== 'totp') {
      setErreur(mfa.genericError);
      return;
    }

    const cle = extraireSecret(data.totpURI);

    if (!cle) {
      setErreur(mfa.genericError);
      return;
    }

    setUriTotp(data.totpURI);
    setSecret(cle);
    setCodesDeSecours(data.backupCodes ?? []);
    setMotDePasse('');
    setEtape('activation');
  }

  async function confirmerCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { error } = await twoFactor.verifyTotp({ code });

    setEnCours(false);

    if (error) {
      setErreur(mfa.invalidCode);
      return;
    }

    router.replace(`/${locale}/dashboard`);
  }

  const champClass =
    'h-14 w-full rounded-[5px] border border-black/30 px-4 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#178064] focus:outline-none focus:ring-1 focus:ring-[#178064]';
  const boutonClass =
    'h-14 w-full rounded-[10px] bg-[#178064] text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

  if (etape === 'motDePasse') {
    return (
      <form onSubmit={demarrerEnrolement} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{mfa.setupTitle}</h2>
          <p className="mt-2 text-sm text-gray-600">{mfa.setupIntro}</p>
        </div>

        <div>
          <label htmlFor="mfa-password" className="mb-2 block text-sm font-medium text-gray-700">
            {mfa.confirmPasswordLabel}
          </label>
          <input
            id="mfa-password"
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className={champClass}
          />
        </div>

        {erreur && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {erreur}
          </p>
        )}

        <button type="submit" disabled={enCours} className={boutonClass}>
          {enCours ? mfa.working : mfa.startSetup}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={confirmerCode} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{mfa.scanTitle}</h2>
        <p className="mt-2 text-sm text-gray-600">{mfa.scanIntro}</p>
      </div>

      {uriTotp && (
        <div className="flex justify-center rounded-lg border border-black/15 bg-white p-5">
          <QRCodeSVG value={uriTotp} size={200} level="M" marginSize={2} />
        </div>
      )}

      <details className="rounded-lg border border-black/15 bg-gray-50 p-4">
        <summary className="cursor-pointer text-sm text-gray-700">{mfa.manualEntry}</summary>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">
          {mfa.secretLabel}
        </p>
        <p className="mt-2 select-all break-all font-mono text-base font-semibold text-gray-900">
          {secret ? formaterSecret(secret) : ''}
        </p>
      </details>

      {codesDeSecours.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">{mfa.backupTitle}</p>
          <p className="mt-1 text-sm text-amber-800">{mfa.backupIntro}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-amber-900">
            {codesDeSecours.map((c) => (
              <li key={c} className="select-all">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="mfa-code" className="mb-2 block text-sm font-medium text-gray-700">
          {mfa.codeLabel}
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className={`${champClass} text-center font-mono text-xl tracking-[0.5em]`}
          placeholder="000000"
        />
      </div>

      {erreur && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <button type="submit" disabled={enCours || code.length !== 6} className={boutonClass}>
        {enCours ? mfa.working : mfa.activate}
      </button>
    </form>
  );
}
