# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FSS Phone Simulator — a web-based Flight Service Station phone call simulator for VATSIM (ZLC ARTCC). Pilots and controllers connect via WebRTC for real-time voice communication focused on IFR clearance delivery. Beta/testing only, not for real VATSIM operations.

## Commands

```bash
# Install all workspace dependencies
npm install

# Run full stack (client + server concurrently)
npm run dev

# Run individually
cd server && npm run dev    # Express + Socket.IO on :3001
cd client && npm run dev    # Vite dev server on :5173

# Production build (builds shared → server → client)
npm run build

# Build individual workspaces
npm run build:shared
npm run build:server
npm run build:client

# Start production server
npm start
```

No automated test suite exists. Testing is manual: open two browser windows, one as controller, one as pilot, verify voice works.

## Architecture

**Monorepo** with npm workspaces: `client/`, `server/`, `shared/`.

### Shared types (`shared/types/`)
TypeScript interfaces used by both client and server. Published as `@fssphone/shared`. Defines Socket.IO event contracts (`events.ts`), controller state (`controller.ts`), and call state (`call.ts`).

### Server (`server/src/`)
Express + Socket.IO. All state is in-memory (no database). Three services:
- **CallManager** — tracks active calls (create, find, update status, auto-cleanup after 5s)
- **ControllerRegistry** — tracks online controllers (register, unregister, availability)
- **SignalingService** — relays WebRTC offers/answers/ICE candidates between peers

`server.ts` wires these together and handles all Socket.IO event routing.

### Client (`client/src/`)
React 18 + TypeScript + Vite + Tailwind CSS. Three routes: `/` (Home), `/pilot`, `/controller`.

Key hooks:
- **useSocket** — Socket.IO connection lifecycle and reconnection
- **useWebRTC** — peer connection setup, local/remote streams, ICE handling. Uses Google STUN servers, audio-only with echo cancellation/noise suppression

`services/socketService.ts` is a singleton Socket.IO client instance.

### Communication flow
1. Controller registers via Socket.IO → server broadcasts updated controller list
2. Pilot initiates call via Socket.IO → server notifies controller
3. Controller answers → server signals both sides to begin WebRTC handshake
4. WebRTC offer/answer/ICE candidates relayed through server via Socket.IO
5. Direct peer-to-peer audio established via WebRTC

## Environment Variables

**Server:** `PORT` (default 3001), `NODE_ENV`, `CLIENT_URL` (for CORS, default `http://localhost:5173`)

**Client:** `VITE_SERVER_URL` (default `http://localhost:3001`)

See `.env.example` files in `client/` and `server/`.

## Deployment

Backend deploys to Railway (see `railway.json`, `nixpacks.toml`). Frontend deploys to Vercel or Netlify from `client/` directory. Node 18+ required.
