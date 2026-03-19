# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic web-app UI with immersive aviation hardware aesthetics — aircraft comm radio for pilots, ATC desk console for controllers.

**Architecture:** Pure visual rewrite. All business logic (hooks, services, WebSocket, WebRTC) stays untouched. We replace the JSX/markup in 3 page components and their CSS, removing dependency on the generic Card/Button/StatusIndicator components in favor of inline panel-styled markup using CSS classes already defined in `index.css`.

**Tech Stack:** React 18, Tailwind CSS (minimal — mostly custom CSS), Share Tech Mono + Oxanium fonts (already imported in index.css).

**Spec:** `docs/superpowers/specs/2026-03-19-ui-redesign-electron-design.md` — sections: Pilot View, Controller View, Home Page, Shared Design System.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/index.css` | Modify | Already has panel/LCD/button CSS. Add any missing utility classes. |
| `client/src/pages/Home.tsx` | Rewrite markup | Dark panel home screen with LCD title, hardware role buttons, user status bar |
| `client/src/pages/PilotView.tsx` | Rewrite markup | Aircraft comm radio panel with integrated LCD station list |
| `client/src/pages/ControllerView.tsx` | Rewrite markup | ATC desk console with phone line status area |
| `client/src/pages/PrivacyPolicy.tsx` | Minor restyle | Match dark aesthetic |
| `client/src/components/common/BetaDisclaimer.tsx` | Rewrite | Panel-styled warning with amber LCD text instead of red card |

Components `Card.tsx`, `Button.tsx`, `StatusIndicator.tsx` become unused after the rewrite. Don't delete them yet — just stop importing them.

---

### Task 1: Home Page — Dark Panel Aesthetic

**Files:**
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/components/common/BetaDisclaimer.tsx`

- [ ] **Step 1: Rewrite BetaDisclaimer as panel-styled warning**

Replace the red card with an amber LCD-style warning bar:

```tsx
// client/src/components/common/BetaDisclaimer.tsx
export default function BetaDisclaimer() {
  return (
    <div className="lcd-display p-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="lcd-text lcd-amber text-sm">⚠</span>
        <div>
          <span className="lcd-text lcd-amber text-xs tracking-wider">BETA — TESTING ONLY</span>
          <span className="lcd-text lcd-dim text-xs ml-3">NOT FOR REAL VATSIM OPS</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite Home.tsx markup**

Replace the entire return JSX. Keep all hooks/logic (useNavigate, useAuth) unchanged. Replace Card/Button imports with inline panel markup:

```tsx
// client/src/pages/Home.tsx
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BetaDisclaimer from '../components/common/BetaDisclaimer';

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--console-bg)' }}>
      <div className="w-full max-w-lg">
        {/* Main panel */}
        <div className="panel" style={{ border: '3px solid var(--panel-edge)', borderRadius: '4px', padding: '20px' }}>
          {/* Screws + label */}
          <div className="flex justify-between items-center mb-4">
            <div className="screw" />
            <span className="panel-label">FSS Phone Simulator</span>
            <div className="screw" />
          </div>

          {/* Title LCD */}
          <div className="lcd-display p-4 mb-4 text-center">
            <div className="lcd-text lcd-green text-2xl tracking-widest mb-1">FSS PHONE</div>
            <div className="lcd-text lcd-dim text-xs tracking-wider">IFR CLEARANCE DELIVERY — WEBRTC VOICE</div>
            <div className="lcd-text lcd-dim text-xs mt-2">VATSIM • ZLC ARTCC SALT LAKE CITY</div>
          </div>

          <BetaDisclaimer />

          {isLoading ? (
            <div className="lcd-display p-4 text-center">
              <span className="lcd-text lcd-dim text-sm">LOADING...</span>
            </div>
          ) : user ? (
            <>
              {/* User status bar */}
              <div className="lcd-display p-3 mb-4 flex justify-between items-center">
                <div>
                  <span className="lcd-text lcd-green text-sm">{user.name.toUpperCase()}</span>
                  <span className="lcd-text lcd-dim text-xs ml-3">CID {user.cid} • {user.ratingShort}</span>
                </div>
                <button onClick={logout} className="hw-btn px-3 py-1 text-xs text-gray-400">
                  SIGN OUT
                </button>
              </div>

              {/* Role buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => navigate('/pilot')} className="hw-btn p-4 text-center">
                  <div className="lcd-text lcd-green text-lg mb-1">PILOT</div>
                  <div className="panel-label" style={{ fontSize: '8px' }}>CALL FSS CONTROLLERS</div>
                </button>
                <button onClick={() => navigate('/controller')} className="hw-btn-green hw-btn p-4 text-center">
                  <div className="lcd-text lcd-amber text-lg mb-1">CONTROLLER</div>
                  <div className="panel-label" style={{ fontSize: '8px' }}>ANSWER PILOT CALLS</div>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center mb-4">
              <div className="lcd-display p-4 mb-3">
                <span className="lcd-text lcd-dim text-xs">SIGN IN WITH VATSIM TO BEGIN</span>
              </div>
              <button onClick={login} className="hw-btn-green hw-btn w-full p-3 text-sm text-green-200 tracking-wider">
                SIGN IN WITH VATSIM
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid var(--panel-edge)' }}>
            <span className="panel-label">ZLC ARTCC — SALT LAKE CITY</span>
            <div className="mt-1">
              <Link to="/privacy" className="panel-label" style={{ color: 'var(--lcd-dim)', fontSize: '8px' }}>PRIVACY POLICY</Link>
            </div>
          </div>

          {/* Bottom screws */}
          <div className="flex justify-between mt-4">
            <div className="screw" />
            <div className="screw" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run: `cd client && npm run dev:local`
Open http://localhost:5173
Expected: Dark panel home page with LCD green title, hardware buttons, screw decorations. No white backgrounds, no rounded cards.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Home.tsx client/src/components/common/BetaDisclaimer.tsx
git commit -m "Restyle Home page as dark aviation panel"
```

---

### Task 2: Pilot View — Aircraft Comm Radio Panel

**Files:**
- Modify: `client/src/pages/PilotView.tsx`

The business logic (all `useEffect` hooks, `handleCall`, `handleHangup`, state variables, refs) stays **exactly the same**. Only the `return (...)` JSX changes.

- [ ] **Step 1: Replace PilotView JSX**

Keep lines 1-121 (imports through `availableControllers` filter) untouched. Replace only the `return (...)` block starting at line 123. The new markup uses these sections:

**Panel shell:** dark background, panel body with screws, panel label "FSS COMM 1"

**Main LCD display:** shows selected controller's frequency (large) and callsign (small). During ringing: "CALLING..." with amber text. During active call: frequency + "ON CALL" label.

**Station list LCD (idle state only):** secondary LCD area listing `availableControllers`. The currently selected station (tracked via new `selectedIdx` state) is bright green, others are dim. ▲/▼ buttons change `selectedIdx`. Count shown at bottom.

**Signal + status bar:** signal bars based on `isConnected`, connection LED.

**PTT bar (active call only):** gray bar reading "HOLD [SPACE] TO TRANSMIT", turns red with `ptt-active` class when `isTransmitting`.

**Error line:** red LCD text for `error` or `webrtcError`.

**Buttons:** ▲ ▼ (gray `hw-btn`), CALL (green `hw-btn hw-btn-green`), END (red `hw-btn hw-btn-red`).

New state to add (line ~20, after existing state):
```tsx
const [selectedIdx, setSelectedIdx] = useState(0);
```

Reset `selectedIdx` when controllers list changes (add to the existing useEffect or a new one):
```tsx
useEffect(() => {
  setSelectedIdx(0);
}, [controllers.length]);
```

The CALL button calls `handleCall(availableControllers[selectedIdx])` instead of per-row buttons.

- [ ] **Step 2: Write the full PilotView return JSX**

The complete return block — all panel markup with the LCD displays, station list, hardware buttons. Reference the CSS classes from `index.css`: `panel`, `lcd-display`, `lcd-text`, `lcd-green`, `lcd-dim`, `lcd-amber`, `lcd-red`, `hw-btn`, `hw-btn-green`, `hw-btn-red`, `screw`, `panel-label`, `signal-bar`, `signal-bar-off`, `ring-pulse`, `ptt-active`, `panel-input`.

Key layout:
```
┌─────────────────────────┐
│ ⊕  FSS COMM 1        ⊕ │  ← screws + label
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │    122.800        │  │  ← main LCD (frequency)
│  │  SEATTLE RADIO    │  │  ← callsign
│  └───────────────────┘  │
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │ ▲ STATIONS ONLINE │  │  ← station list LCD
│  │ BOISE RADIO  122.2│  │
│  │►SEATTLE RAD 122.8 │  │  ← selected (bright)
│  │ OAKLAND RAD 123.6 │  │
│  │ ▼ 3 STATIONS      │  │
│  └───────────────────┘  │
├─────────────────────────┤
│ ▓▓▓░░  ● CONNECTED     │  ← signal bars + LED
├─────────────────────────┤
│ [ERROR LINE IF ANY]     │  ← red LCD text
├─────────────────────────┤
│ [▲] [▼] [CALL] [END]   │  ← hardware buttons
├─────────────────────────┤
│ HOLD [SPACE] TO TRANSMIT│  ← PTT bar (active call)
├─────────────────────────┤
│ ⊕                    ⊕ │  ← bottom screws
└─────────────────────────┘
```

Callsign input appears on the main LCD area when no call is active: a `panel-input` field inside the LCD display div.

`<audio ref={remoteAudioRef} autoPlay />` goes at the bottom, hidden.

- [ ] **Step 3: Verify all 4 states in browser**

Run dev server. Check:
1. Idle/Setup: callsign input visible, station list shows (or "NO STATIONS" if none online)
2. Ringing: main LCD shows amber "CALLING..." + target frequency
3. Active: main LCD shows green frequency + callsign, PTT bar visible
4. After hangup: returns to idle

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/PilotView.tsx
git commit -m "Rewrite PilotView as aircraft comm radio panel"
```

---

### Task 3: Controller View — ATC Desk Console

**Files:**
- Modify: `client/src/pages/ControllerView.tsx`

Same approach: business logic stays, only JSX changes.

- [ ] **Step 1: Replace ControllerView JSX**

Keep all imports, hooks, state, handlers untouched. Replace only the return block.

**Offline state (setup):** dark panel with callsign + frequency `panel-input` fields inside LCD displays, GO ONLINE button (green hw-btn).

**Online state:** single wide console panel:

```
┌─────────────────────────────────────┐
│ ZLC FSS CONSOLE    ●PWR ●NET ○REC  │  ← header with LEDs
├─────────────────────────────────────┤
│ ┌─────────────┬───────────────────┐ │
│ │ POSITION    │ FREQ              │ │
│ │ SEATTLE RAD │ 122.800           │ │  ← amber LCD
│ └─────────────┴───────────────────┘ │
├─────────────────────────────────────┤
│  PHONE LINES                        │
│ ┌─────────────────────────────────┐ │
│ │ ◉ LINE 1  N12345     RINGING   │ │  ← amber LED
│ │ ○ LINE 2  —          IDLE      │ │  ← off LED
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│    HOLD [SPACE] TO TRANSMIT         │  ← PTT bar
├─────────────────────────────────────┤
│ [ANSWER] [REJECT] [HANGUP] [OFF]   │  ← buttons
└─────────────────────────────────────┘
```

Phone line 1 state depends on `incomingCall` / `currentCall`:
- No call: LED off, "—", "IDLE"
- `incomingCall`: amber LED (`led-on-amber`), callsign, "RINGING" (with `ring-pulse`)
- `currentCall`: green LED (`led-on-green`), callsign, "ACTIVE"

PTT bar only visible when `currentCall` is active.

ANSWER/REJECT buttons: only enabled when `incomingCall` exists.
HANGUP: only enabled when `currentCall` exists.
OFF: calls `handleGoOffline`.

All button text uses amber color scheme: green button text is `#aaffaa`, red is `#ffaaaa`, gray is `#aaa`.

- [ ] **Step 2: Verify all 4 states**

1. Offline: dark panel with LCD inputs
2. Online idle: console with empty phone lines
3. Incoming: line 1 shows amber ringing state
4. Active: line 1 shows green active state, PTT bar visible

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ControllerView.tsx
git commit -m "Rewrite ControllerView as ATC desk console"
```

---

### Task 4: Privacy Policy Restyle

**Files:**
- Modify: `client/src/pages/PrivacyPolicy.tsx`

- [ ] **Step 1: Restyle to dark panel**

Replace the light card wrapper with dark panel styling. Use `panel` class for the body, `lcd-text lcd-green` for headings, default gray for body text. Back button becomes `hw-btn`.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/PrivacyPolicy.tsx
git commit -m "Restyle PrivacyPolicy to dark panel aesthetic"
```

---

### Task 5: Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd client && npx tsc
```
Expected: no errors

- [ ] **Step 2: Run Vite production build**

```bash
npx vite build
```
Expected: successful build, no warnings about unused imports

- [ ] **Step 3: Run all worker tests**

```bash
cd ../worker && npm test
```
Expected: 69 tests pass (UI changes don't affect worker tests, but verify nothing broke)

- [ ] **Step 4: Visual review in browser**

Open each page and verify:
- Home: dark panel, LCD title, hardware buttons
- Pilot: comm radio panel, station list scrollable, PTT bar
- Controller: ATC console, phone lines, amber LCD
- Privacy: dark styled, readable
- No white backgrounds anywhere
- No Card/Button/StatusIndicator generic components visible

- [ ] **Step 5: Final commit if any fixes needed**

---

### Task 6: Push and PR

- [ ] **Step 1: Create branch and push**

```bash
git checkout -b feat/ui-redesign
git push -u origin feat/ui-redesign
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "Redesign UI as aviation hardware" --body "Pilot view: aircraft comm radio panel with green phosphor LCD and integrated station list. Controller view: ATC desk console with amber LCD and phone line status. Home page: dark panel with hardware buttons."
```
