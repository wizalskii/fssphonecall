import { SignJWT, jwtVerify } from 'jose';
import type { VatsimUser } from '@fssphone/shared';

function getSecret(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export async function signToken(user: VatsimUser, jwtSecret: string): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret(jwtSecret));
}

export async function verifyToken(token: string, jwtSecret: string): Promise<VatsimUser> {
  const { payload } = await jwtVerify(token, getSecret(jwtSecret));
  return {
    cid: payload.cid as string,
    name: payload.name as string,
    rating: payload.rating as number,
    ratingShort: payload.ratingShort as string,
    ratingLong: payload.ratingLong as string,
  };
}
