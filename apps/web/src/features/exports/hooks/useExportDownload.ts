'use client';

import { useState } from 'react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Le backend (EXPORT-01) genere les fichiers et pose lui-meme le nom dans
 * Content-Disposition. On ne peut pas s'y fier depuis le navigateur : l'API
 * vit sur une autre origine, et un en-tete de reponse n'est lisible en CORS que
 * s'il figure explicitement dans Access-Control-Expose-Headers. D'ou le nom de
 * repli passe par l'appelant.
 *
 * Un simple <a href> ne conviendrait pas non plus : la session medecin est un
 * cookie, et une navigation vers une autre origine ne l'emporte pas de facon
 * fiable. Il faut donc `fetch` avec credentials, puis declencher le
 * telechargement depuis le blob.
 */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || null;
}

export function useExportDownload() {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function download(path: string, fallbackName: string) {
    setPending(path);
    setFailed(false);

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('EXPORT_FAILED');
      }

      const blob = await response.blob();
      const name = filenameFromDisposition(response.headers.get('Content-Disposition'));
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = objectUrl;
      link.download = name ?? fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return { download, pending, failed };
}
