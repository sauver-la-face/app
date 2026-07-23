import { sign, verify } from 'hono/jwt';
import type { TokenPayload, TokenProvider } from '../application/tokenProvider';

export class JwtTokenProvider implements TokenProvider {
  constructor(private readonly secret: string) {}

  async sign(payload: TokenPayload): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const oneYearInSeconds = 365 * 24 * 60 * 60;

    const data = {
      ...payload,
      iat: now,
      exp: now + oneYearInSeconds,
    };

    return sign(data, this.secret, 'HS256');
  }

  async verify(token: string): Promise<TokenPayload | null> {
    try {
      const payload = await verify(token, this.secret, 'HS256');

      if (
        payload.role !== 'patient' ||
        typeof payload.uuid_patient !== 'string' ||
        typeof payload.uuid_patient_code !== 'string'
      ) {
        return null;
      }

      return {
        uuid_patient: payload.uuid_patient,
        uuid_patient_code: payload.uuid_patient_code,
        role: 'patient',
      };
    } catch {
      // Signature invalide, token expire ou malforme : hono/jwt leve une
      // exception dans tous ces cas - on la traduit en 401 cote appelant.
      return null;
    }
  }
}
