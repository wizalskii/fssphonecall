import { handleAuthVatsim, handleAuthCallback, handleAuthMe } from './auth';
import { handleCors, corsHeaders } from './utils/cors';
import { verifyToken, signWsTicket, verifyWsTicket } from './utils/jwt';
export { LobbyDO } from './lobby';

export interface Env {
  LOBBY: DurableObjectNamespace;
  VATSIM_AUTH_URL: string;
  VATSIM_CLIENT_ID: string;
  VATSIM_CLIENT_SECRET: string;
  VATSIM_REDIRECT_URI: string;
  JWT_SECRET: string;
  CLIENT_URL: string;
  TURN_KEY_ID: string;
  TURN_API_TOKEN: string;
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

    // TURN credentials
    if (url.pathname === '/turn-credentials') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        await verifyToken(authHeader.slice(7), env.JWT_SECRET);
      } catch {
        return new Response('Invalid token', { status: 401 });
      }

      // Generate short-lived TURN credentials via Cloudflare Calls API
      if (env.TURN_KEY_ID && env.TURN_API_TOKEN) {
        try {
          const res = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.TURN_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ ttl: 300 }),
            }
          );
          const creds = await res.json() as { iceServers: { username: string; credential: string } };
          return new Response(JSON.stringify(creds.iceServers), {
            headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
          });
        } catch {
          return new Response(JSON.stringify({ error: 'TURN unavailable' }), {
            status: 503,
            headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ error: 'TURN not configured' }), {
        status: 503,
        headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
      });
    }

    // Exchange long-lived JWT for a short-lived WebSocket ticket
    if (url.pathname === '/ws-ticket') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const user = await verifyToken(authHeader.slice(7), env.JWT_SECRET);
        const ticket = await signWsTicket(user, env.JWT_SECRET);
        return new Response(JSON.stringify({ ticket }), {
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response('Invalid token', { status: 401 });
      }
    }

    // WebSocket upgrade -> Durable Object
    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // Authenticate short-lived WS ticket from query param
      const ticket = url.searchParams.get('ticket');
      if (!ticket) {
        return new Response('Missing ticket', { status: 401 });
      }

      let user;
      try {
        user = await verifyWsTicket(ticket, env.JWT_SECRET);
      } catch {
        return new Response('Invalid or expired ticket', { status: 401 });
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
