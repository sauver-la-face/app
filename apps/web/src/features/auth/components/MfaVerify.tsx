'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { twoFactor } from '@/lib/authClient';

/**
 * Second facteur demande apres la verification du mot de passe.
 * Le code de secours est propose en repli : sans lui, la perte du telephone
 * verrouille definitivement le compte, ce qui est inacceptable pour un medecin
 * en mission.
 */
export function MfaVerify({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const router = useRouter();
  const { mfa } = dictionary;

  const [modeSecours, setModeSecours] = useState(false);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { error } = modeSecours
      ? await twoFactor.verifyBackupCode({ code })
      : await twoFactor.verifyTotp({ code });

    setEnCours(false);

    if (error) {
      setErreur(modeSecours ? mfa.invalidBackupCode : mfa.invalidCode);
      setCode('');
      return;
    }

    router.replace(`/${locale}/dashboard`);
  }

  const champClass =
    'h-14 w-full rounded-[5px] border border-black/30 px-4 text-sm shadow-[0px_4px_4px_rgba(0,0,0,0.25)] focus:border-[#178064] focus:outline-none focus:ring-1 focus:ring-[#178064]';

  return (
    <form onSubmit={verifier} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{mfa.verifyTitle}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {modeSecours ? mfa.backupIntroVerify : mfa.verifyIntro}
        </p>
      </div>

      <div>
        <label htmlFor="mfa-verify-code" className="mb-2 block text-sm font-medium text-gray-700">
          {modeSecours ? mfa.backupCodeLabel : mfa.codeLabel}
        </label>
        <input
          id="mfa-verify-code"
          inputMode={modeSecours ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={modeSecours ? 32 : 6}
          required
          value={code}
          onChange={(e) =>
            setCode(modeSecours ? e.target.value.trim() : e.target.value.replace(/\D/g, ''))
          }
          className={
            modeSecours
              ? `${champClass} font-mono`
              : `${champClass} text-center font-mono text-xl tracking-[0.5em]`
          }
          placeholder={modeSecours ? '' : '000000'}
        />
      </div>

      {erreur && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours || (modeSecours ? code.length === 0 : code.length !== 6)}
        className="h-14 w-full rounded-[10px] bg-[#178064] text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enCours ? mfa.working : mfa.verify}
      </button>

      <button
        type="button"
        onClick={() => {
          setModeSecours((v) => !v);
          setCode('');
          setErreur(null);
        }}
        className="w-full text-sm text-[#178064] underline hover:opacity-80"
      >
        {modeSecours ? mfa.useTotpInstead : mfa.useBackupInstead}
      </button>
    </form>
  );
}
