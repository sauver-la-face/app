import { sign } from 'hono/jwt';
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

    return sign(data, this.secret);
  }
}
