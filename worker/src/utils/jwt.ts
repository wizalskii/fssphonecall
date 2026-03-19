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

/** Sign a short-lived WebSocket ticket (60s) with a unique JTI for single-use enforcement */
export async function signWsTicket(user: VatsimUser, jwtSecret: string): Promise<string> {
  return await new SignJWT({ ...user, purpose: 'ws-ticket' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime('60s')
    .sign(getSecret(jwtSecret));
}

export interface WsTicketResult {
  user: VatsimUser;
  jti: string;
}

export async function verifyWsTicket(ticket: string, jwtSecret: string): Promise<WsTicketResult> {
  const { payload } = await jwtVerify(ticket, getSecret(jwtSecret));
  if (payload.purpose !== 'ws-ticket') throw new Error('Not a WS ticket');
  if (!payload.jti) throw new Error('Missing ticket ID');
  return {
    user: {
      cid: payload.cid as string,
      name: payload.name as string,
      rating: payload.rating as number,
      ratingShort: payload.ratingShort as string,
      ratingLong: payload.ratingLong as string,
    },
    jti: payload.jti,
  };
}
