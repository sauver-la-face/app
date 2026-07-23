import { describe, expect, test } from 'bun:test';
import { sign } from 'hono/jwt';

import { JwtTokenProvider } from '../src/features/auth/infrastructure/jwtTokenProvider';

const payload = {
  uuid_patient: '11111111-1111-4111-8111-111111111111',
  uuid_patient_code: '22222222-2222-4222-8222-222222222222',
  role: 'patient' as const,
};

describe('JwtTokenProvider (SEC-02/A01/A07)', () => {
  test('sign puis verify retourne le meme payload', async () => {
    const provider = new JwtTokenProvider('secret-a');
    const token = await provider.sign(payload);

    const verified = await provider.verify(token);

    expect(verified).toEqual(payload);
  });

  test('verify retourne null pour un token signe avec un secret different', async () => {
    const provider = new JwtTokenProvider('secret-a');
    const tokenSignedElsewhere = await new JwtTokenProvider('secret-b').sign(payload);

    const verified = await provider.verify(tokenSignedElsewhere);

    expect(verified).toBeNull();
  });

  test('verify retourne null pour un token expire', async () => {
    const provider = new JwtTokenProvider('secret-a');
    const past = Math.floor(Date.now() / 1000) - 60;
    const expiredToken = await sign({ ...payload, iat: past - 10, exp: past }, 'secret-a', 'HS256');

    const verified = await provider.verify(expiredToken);

    expect(verified).toBeNull();
  });

  test('verify retourne null pour un token malforme', async () => {
    const provider = new JwtTokenProvider('secret-a');

    const verified = await provider.verify('not-a-jwt');

    expect(verified).toBeNull();
  });

  test('verify retourne null si le role n est pas "patient"', async () => {
    const provider = new JwtTokenProvider('secret-a');
    const now = Math.floor(Date.now() / 1000);
    const wrongRoleToken = await sign(
      { ...payload, role: 'physician', iat: now, exp: now + 3600 },
      'secret-a',
      'HS256',
    );

    const verified = await provider.verify(wrongRoleToken);

    expect(verified).toBeNull();
  });
});
