# FSS Phone Simulator — UI Redesign + Electron App

## Overview

Redesign the web UI to look like real aviation hardware (not a web app), and package it as an Electron desktop app with global PTT, audio device selection, and auto-update from Cloudflare R2.

## Pilot View — Aircraft Comm Radio Panel

- Dark anodized aluminum panel body with Phillips head screw decorations at corners
- Recessed green phosphor LCD display (Share Tech Mono font, `#39ff14` on `#0a0f04`)
- Main LCD shows: selected frequency (large), station callsign (small below)
- Integrated station list on a secondary LCD area:
  - Arrow buttons (▲/▼) to scroll through online controllers
  - Selected station highlighted in bright green, others dim green
  - Shows station count at bottom
- Signal strength bars (3-5 bars) indicating WebSocket connection quality
- Connection status LED (green dot + "CONNECTED" text)
- Hardware buttons at bottom: ▲ ▼ (gray), CALL (green gradient), END (red gradient)
- PTT indicator bar: gray "HOLD [KEY] TO TRANSMIT" normally, red glow + "TRANSMITTING" when active
- Callsign input: panel-style LCD input field (green text, dark background)
- Error messages: red LCD text in a dedicated status line area
- No cards, no rounded corners, no white backgrounds

### States

1. **Setup** — callsign input on LCD panel, station list below
2. **Ringing** — main LCD shows target frequency + "CALLING..." with amber pulse
3. **Active** — main LCD shows frequency + callsign, PTT bar visible, HANGUP button active
4. **Idle** — back to setup with station list

## Controller View — ATC Desk Console

- Single wide console panel with amber LCD displays (`#ffbf00` on `#0a0f04`)
- Header bar: "ZLC FSS CONSOLE" label, status LEDs (PWR, NET, REC)
- Position display: LCD showing callsign (left) and frequency (right)
- Phone line status area:
  - Each line shows: LED indicator, line number, caller callsign, state text
  - LED colors: amber=ringing, green=active, off=idle
  - Ringing line has amber background tint
- PTT bar: same as pilot but amber theme
- Action buttons: ANSWER (green), REJECT (red), HANGUP (red), OFF (gray)
- All buttons use 3D gradient hardware button style

### States

1. **Offline** — setup panel with callsign + frequency LCD inputs, GO ONLINE button
2. **Online idle** — console showing position/freq, empty phone lines, "Waiting for calls..."
3. **Incoming** — phone line shows ringing state with amber LED, ANSWER/REJECT buttons active
4. **Active call** — phone line shows active state with green LED, PTT bar visible, HANGUP active

## Home Page

- Dark background matching the console aesthetic
- "FSS PHONE SIMULATOR" in LCD-style text with green glow
- VATSIM / ZLC ARTCC labels as panel engravings
- Two hardware-style buttons: PILOT (blue-ish gradient) and CONTROLLER (green gradient)
- Signed-in user info in a small LCD status bar
- Sign in button styled as a hardware button

## Shared Design System

- **Fonts**: Share Tech Mono (LCD text), Oxanium (panel labels, buttons)
- **Panel body**: `#1a1d21` with subtle horizontal line texture
- **LCD background**: `#0a0f04` with inset shadow
- **Pilot LCD color**: green `#39ff14`
- **Controller LCD color**: amber `#ffbf00`
- **Hardware buttons**: 3D linear-gradient (highlight → face → shadow), 1px press animation
- **LEDs**: 6-8px circles with colored box-shadow glow
- **Screws**: 12px radial-gradient circles with slot line
- **Panel labels**: 9px Oxanium, uppercase, letter-spacing, gray `#8a8d95`
- **Console background**: `#0d0f12`
- **Input fields**: LCD-style (dark bg, green/amber text, inset shadow)

## Electron App

### Structure

```
electron/
  main.ts          — Electron main process
  preload.ts       — IPC bridge for global shortcuts, audio devices
  package.json     — Electron deps, build config
  electron-builder.yml  — Build/publish config
```

The Electron app loads the same Vite-built client (either from local dist or the Cloudflare Pages URL in dev).

### Global PTT

- Default key: Numpad 0
- Uses Electron's `globalShortcut` API to register the PTT key
- Key press/release events sent to renderer via IPC (`ipcRenderer`)
- Works even when app is not focused (true global hotkey)
- User can rebind via Settings menu ("Press a key to bind" interface)
- PTT key stored in electron-store persistent config

### Audio Device Selection

- Enumerate devices via `navigator.mediaDevices.enumerateDevices()` in renderer
- Settings panel shows:
  - **Input device** dropdown (microphones)
  - **Output device** dropdown (speakers/headsets)
  - **Test mic** button: records 3 seconds, plays back through selected output
  - **Test speakers** button: plays a short tone through selected output
- Selected devices stored in electron-store config
- Applied to `getUserMedia` constraints and `audio.setSinkId()`

### Settings Menu

- Accessible via system tray icon or menu bar
- Opens a modal/panel styled to match the console aesthetic (dark panel, LCD inputs)
- Sections:
  - **PTT Key**: current binding displayed, "Change" button opens rebind dialog
  - **Audio Input**: device dropdown + test button
  - **Audio Output**: device dropdown + test button
  - **About**: version number, update status

### Auto-Update from R2

- Uses `electron-updater` with generic provider
- Update feed URL points to Cloudflare R2 bucket (e.g., `https://releases.virtualfssphone.cc`)
- R2 bucket contains:
  - `latest.yml` (Windows) / `latest-mac.yml` (Mac) — version manifest
  - Installer files (`.exe` NSIS for Windows, `.dmg` for Mac)
- On app launch: check for updates silently
- If update available: show notification in status bar, user clicks to install
- Build pipeline: GitHub Action builds Electron app, uploads to R2

### Build & Distribution

- `electron-builder` for packaging
- Windows: NSIS installer (`.exe`)
- Mac: DMG (`.dmg`)
- Publish to R2 via `electron-builder --publish always` with S3-compatible config
- GitHub Action triggered on version tag push

## What Changes

| Area | Change |
|------|--------|
| `client/src/pages/PilotView.tsx` | Full rewrite — aircraft comm radio panel |
| `client/src/pages/ControllerView.tsx` | Full rewrite — ATC desk console |
| `client/src/pages/Home.tsx` | Restyle to dark panel aesthetic |
| `client/src/index.css` | Already has CSS foundation, extend as needed |
| `client/src/components/common/` | Deprecate Card, Button, StatusIndicator — replace with inline panel markup |
| `electron/` | New directory — main process, preload, build config |
| `package.json` (root) | Add electron workspace |
| `.github/workflows/` | Add Electron build + R2 publish workflow |

## VATSIM Network Integration

### Data Feed Polling

Poll `https://data.vatsim.net/v3/vatsim-data.json` (public, no auth, refreshes every 15s) to:

1. **Auto-detect if signed-in user is on the network**: search `pilots` and `controllers` arrays for matching CID
2. **Auto-populate callsign**: if found, pre-fill the callsign field
3. **Detect role**: if CID is in `controllers` array, they're ATC; if in `pilots`, they're a pilot
4. **Show real FSS controllers**: filter `controllers` array for `facility: 1` (FSS) to show actual VATSIM FSS positions

### Worker Endpoint

Add `GET /vatsim-status?cid={cid}` to the Worker:
- Fetches the data feed (cached in Worker for 15s via `caches` API)
- Searches for the CID across pilots, controllers, atis arrays
- Returns: `{ online: boolean, type: "pilot"|"controller"|"atis"|null, callsign: string|null, frequency: string|null }`
- Client calls this on login and periodically (every 30s)

### Beta Guard Toggle

- Worker env var: `REQUIRE_VATSIM_CONNECTION` (default: `"false"` during beta)
- When `"true"`: users must be connected to VATSIM to use the app. If not connected, show an LCD-style message: "NOT CONNECTED TO VATSIM NETWORK"
- When `"false"`: anyone with a valid VATSIM SSO login can use the app regardless of network connection status
- Client env var: `VITE_REQUIRE_VATSIM_CONNECTION` mirrors the server setting for UI gating

### Data Feed Response Shape (key fields)

**Pilot**: `{ cid, callsign, latitude, longitude, altitude, groundspeed, flight_plan: { departure, arrival } }`
**Controller**: `{ cid, callsign, frequency, facility, rating, text_atis }`
**Facility IDs**: 0=OBS, 1=FSS, 2=DEL, 3=GND, 4=TWR, 5=APP, 6=CTR

## What Stays

- All hooks (useSocket, useWebRTC, useAuth) — unchanged
- socketService.ts — unchanged
- AuthContext — unchanged
- Worker backend — unchanged (plus new /vatsim-status endpoint)
- Shared types — unchanged
- Privacy policy page — minor restyle

## Implementation Order

1. Restyle index.css + Home.tsx (dark panel aesthetic)
2. Rewrite PilotView.tsx (aircraft comm radio)
3. Rewrite ControllerView.tsx (ATC desk console)
4. Add VATSIM data feed integration (worker endpoint + client polling)
5. Scaffold Electron app (main process, preload, build config)
6. Add global PTT via Electron IPC
7. Add audio device settings panel
8. Add auto-updater with R2
9. GitHub Action for Electron build + R2 publish
