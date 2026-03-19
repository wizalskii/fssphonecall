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
  REQUIRE_VATSIM_CONNECTION: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }
      try {
        await verifyToken(authHeader.slice(7), env.JWT_SECRET);
      } catch {
        return new Response('Invalid token', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
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
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }
      try {
        const user = await verifyToken(authHeader.slice(7), env.JWT_SECRET);
        const ticket = await signWsTicket(user, env.JWT_SECRET);
        return new Response(JSON.stringify({ ticket }), {
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response('Invalid token', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }
    }

    // VATSIM online status lookup
    if (url.pathname === '/vatsim-status') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }
      try {
        await verifyToken(authHeader.slice(7), env.JWT_SECRET);
      } catch {
        return new Response('Invalid token', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }

      const cid = url.searchParams.get('cid');
      if (!cid) {
        return new Response(JSON.stringify({ error: 'Missing cid parameter' }), {
          status: 400,
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
      }

      const cidNumber = Number(cid);
      if (Number.isNaN(cidNumber)) {
        return new Response(JSON.stringify({ error: 'Invalid cid parameter' }), {
          status: 400,
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
      }

      try {
        const cache = caches.default;
        const cacheKey = new Request('https://data.vatsim.net/v3/vatsim-data.json');
        let dataRes = await cache.match(cacheKey);
        if (!dataRes) {
          dataRes = await fetch('https://data.vatsim.net/v3/vatsim-data.json');
          const cached = new Response(dataRes.body, dataRes);
          cached.headers.set('Cache-Control', 'public, max-age=15');
          ctx.waitUntil(cache.put(cacheKey, cached.clone()));
          dataRes = cached;
        }

        const data = await dataRes.json() as {
          pilots: { cid: number; callsign: string }[];
          controllers: { cid: number; callsign: string; frequency: string; facility: number }[];
          atis: { cid: number; callsign: string; frequency: string }[];
        };

        // Search pilots
        const pilot = data.pilots.find((p) => p.cid === cidNumber);
        if (pilot) {
          return new Response(JSON.stringify({
            online: true,
            type: 'pilot',
            callsign: pilot.callsign,
            frequency: null,
            requireConnection: env.REQUIRE_VATSIM_CONNECTION === 'true',
          }), {
            headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
          });
        }

        // Search controllers
        const controller = data.controllers.find((c) => c.cid === cidNumber);
        if (controller) {
          return new Response(JSON.stringify({
            online: true,
            type: 'controller',
            callsign: controller.callsign,
            frequency: controller.frequency,
            requireConnection: env.REQUIRE_VATSIM_CONNECTION === 'true',
          }), {
            headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
          });
        }

        // Search ATIS
        const atis = data.atis.find((a) => a.cid === cidNumber);
        if (atis) {
          return new Response(JSON.stringify({
            online: true,
            type: 'atis',
            callsign: atis.callsign,
            frequency: atis.frequency,
            requireConnection: env.REQUIRE_VATSIM_CONNECTION === 'true',
          }), {
            headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
          });
        }

        // Not found online
        return new Response(JSON.stringify({
          online: false,
          type: null,
          callsign: null,
          frequency: null,
          requireConnection: env.REQUIRE_VATSIM_CONNECTION === 'true',
        }), {
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to fetch VATSIM data' }), {
          status: 502,
          headers: { ...corsHeaders(env.CLIENT_URL), 'Content-Type': 'application/json' },
        });
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
        return new Response('Missing ticket', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }

      let result;
      try {
        result = await verifyWsTicket(ticket, env.JWT_SECRET);
      } catch {
        return new Response('Invalid or expired ticket', { status: 401, headers: corsHeaders(env.CLIENT_URL) });
      }

      // Forward to the singleton Lobby DO with user info + ticket JTI in headers
      const id = env.LOBBY.idFromName('lobby');
      const stub = env.LOBBY.get(id);
      const headers = new Headers(request.headers);
      headers.set('X-User-CID', result.user.cid);
      headers.set('X-User-Name', result.user.name);
      headers.set('X-User-Rating', String(result.user.rating));
      headers.set('X-User-Rating-Short', result.user.ratingShort);
      headers.set('X-User-Rating-Long', result.user.ratingLong);
      headers.set('X-Ticket-JTI', result.jti);
      return stub.fetch(new Request(request.url, { method: request.method, headers }));
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
