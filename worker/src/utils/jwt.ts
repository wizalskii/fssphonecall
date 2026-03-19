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

/** Sign a short-lived WebSocket ticket (60s) to avoid exposing the main JWT in URLs */
export async function signWsTicket(user: VatsimUser, jwtSecret: string): Promise<string> {
  return await new SignJWT({ ...user, purpose: 'ws-ticket' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(getSecret(jwtSecret));
}

export async function verifyWsTicket(ticket: string, jwtSecret: string): Promise<VatsimUser> {
  const { payload } = await jwtVerify(ticket, getSecret(jwtSecret));
  if (payload.purpose !== 'ws-ticket') throw new Error('Not a WS ticket');
  return {
    cid: payload.cid as string,
    name: payload.name as string,
    rating: payload.rating as number,
    ratingShort: payload.ratingShort as string,
    ratingLong: payload.ratingLong as string,
  };
}
