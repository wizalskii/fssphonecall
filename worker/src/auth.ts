import { signToken, verifyToken } from './utils/jwt';
import { corsHeaders } from './utils/cors';
import type { Env } from './index';
import type { VatsimUser } from '@fssphone/shared';

export async function handleAuthVatsim(env: Env): Promise<Response> {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.VATSIM_CLIENT_ID,
    redirect_uri: env.VATSIM_REDIRECT_URI,
    scope: 'full_name vatsim_details',
  });
  return Response.redirect(`${env.VATSIM_AUTH_URL}/oauth/authorize?${params}`, 302);
}

export async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return Response.redirect(`${env.CLIENT_URL}?error=missing_code`, 302);
  }

  try {
    const tokenRes = await fetch(`${env.VATSIM_AUTH_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.VATSIM_CLIENT_ID,
        client_secret: env.VATSIM_CLIENT_SECRET,
        code,
        redirect_uri: env.VATSIM_REDIRECT_URI,
      }).toString(),
    });

    const tokenData = await tokenRes.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    const userRes = await fetch(`${env.VATSIM_AUTH_URL}/api/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = await userRes.json() as { data: { cid: string; personal: { name_full: string }; vatsim: { rating: { id: number; short: string; long: string } } } };
    const d = userData.data;
    const user: VatsimUser = {
      cid: d.cid,
      name: d.personal.name_full,
      rating: d.vatsim.rating.id,
      ratingShort: d.vatsim.rating.short,
      ratingLong: d.vatsim.rating.long,
    };

    const token = await signToken(user, env.JWT_SECRET);
    return Response.redirect(`${env.CLIENT_URL}/auth/callback?token=${token}`, 302);
  } catch (err) {
    console.error('VATSIM OAuth error:', err);
    return Response.redirect(`${env.CLIENT_URL}?error=auth_failed`, 302);
  }
}

export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  const headers = corsHeaders(env.CLIENT_URL);
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const user = await verifyToken(authHeader.slice(7), env.JWT_SECRET);
    return new Response(JSON.stringify({ user }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}
