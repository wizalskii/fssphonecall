import { handleAuthVatsim, handleAuthCallback, handleAuthMe } from './auth';
import { handleCors, corsHeaders } from './utils/cors';
import { verifyToken } from './utils/jwt';
export { LobbyDO } from './lobby';

export interface Env {
  LOBBY: DurableObjectNamespace;
  VATSIM_AUTH_URL: string;
  VATSIM_CLIENT_ID: string;
  VATSIM_CLIENT_SECRET: string;
  VATSIM_REDIRECT_URI: string;
  JWT_SECRET: string;
  CLIENT_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    const corsResponse = handleCors(request, env.CLIENT_URL);
    if (corsResponse) return corsResponse;

    // Auth routes
    if (url.pathname === '/auth/vatsim') {
      return handleAuthVatsim(env);
    }
    if (url.pathname === '/auth/vatsim/callback') {
      return handleAuthCallback(request, env);
    }
    if (url.pathname === '/auth/me') {
      return handleAuthMe(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
      });
    }

    // WebSocket upgrade -> Durable Object
    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // Authenticate JWT from query param
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('Missing token', { status: 401 });
      }

      let user;
      try {
        user = await verifyToken(token, env.JWT_SECRET);
      } catch {
        return new Response('Invalid token', { status: 401 });
      }

      // Forward to the singleton Lobby DO with user info in headers
      const id = env.LOBBY.idFromName('lobby');
      const stub = env.LOBBY.get(id);
      const headers = new Headers(request.headers);
      headers.set('X-User-CID', user.cid);
      headers.set('X-User-Name', user.name);
      headers.set('X-User-Rating', String(user.rating));
      headers.set('X-User-Rating-Short', user.ratingShort);
      headers.set('X-User-Rating-Long', user.ratingLong);
      return stub.fetch(new Request(request.url, { method: request.method, headers }));
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
