# FSS Phone Simulator

**BETA - TESTING ONLY**

A web-based Flight Service Station (FSS) phone call simulator for VATSIM with real-time voice communication.

**Developed for ZLC ARTCC (Salt Lake City ARTCC)**

## ⚠️ IMPORTANT DISCLAIMER

**THIS IS A BETA TESTING APPLICATION AND IS NOT INTENDED FOR ACTUAL VATSIM OPERATIONS.**

- Do NOT use this for real VATSIM flights or ATC sessions
- This is a training and testing tool only
- For official VATSIM communications, use approved channels
- Not affiliated with or endorsed by official VATSIM operations

## Features

- **Real Voice Communication**: WebRTC-based voice calls between pilots and controllers
- **Simple Interface**: Separate pilot and controller views
- **IFR Clearance Delivery**: Focused on clearance delivery workflow
- **Standalone**: No VATSIM API integration - fully standalone for testing

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Modern web browser with WebRTC support (Chrome, Firefox, Edge)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd fssphone
   ```

2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   cd ../shared && npm install
   cd ..
   ```

3. Set up environment variables:
   ```bash
   # Server
   cp server/.env.example server/.env

   # Client
   cp client/.env.example client/.env
   ```

4. **Add Logos** (Optional):
   - Place VATSIM logo at `client/public/vatsim-logo.png`
   - Place ZLC ARTCC logo at `client/public/zlc-logo.png`

## Development

Run both client and server concurrently:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Server
cd server && npm run dev

# Terminal 2 - Client
cd client && npm run dev
```

Access the application:
- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

## Usage

### As a Controller

1. Navigate to the home page
2. Click "Enter as Controller"
3. Enter your callsign (e.g., "Seattle Radio") and frequency (e.g., "122.200")
4. Click "Go Online"
5. Wait for incoming calls from pilots
6. Answer calls and communicate via voice

### As a Pilot

1. Navigate to the home page
2. Click "Enter as Pilot"
3. Enter your callsign (e.g., "N12345")
4. See the list of available controllers
5. Click "Call" on a controller
6. Wait for them to answer
7. Communicate via voice for clearance delivery

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Communication**: WebRTC for voice, Socket.IO for signaling
- **Monorepo**: Workspaces for client, server, and shared types

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Socket.IO Client
- React Router

### Backend
- Node.js + Express
- Socket.IO (signaling server)
- TypeScript

### WebRTC
- Native WebRTC APIs
- STUN servers (Google's public STUN)

## Project Structure

```
fssphone/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks (WebRTC, Socket)
│   │   ├── pages/        # Route pages
│   │   └── services/     # Socket service
│   └── package.json
├── server/           # Node.js backend
│   ├── src/
│   │   ├── services/     # Business logic
│   │   └── server.ts     # Main entry point
│   └── package.json
├── shared/           # Shared TypeScript types
│   └── types/
└── package.json      # Root workspace config
```

## Testing

1. Open two browser windows
2. Window 1: Select "Controller", enter details, go online
3. Window 2: Select "Pilot", enter callsign, call the controller
4. Controller answers the call
5. Verify bidirectional voice communication works
6. Either party can hang up

## Browser Support

- Chrome/Edge (Chromium) - Primary target
- Firefox - Supported
- Safari - Supported (may require HTTPS for microphone access)

## Troubleshooting

### Microphone Permission Denied
- Grant microphone permissions in your browser
- Check browser settings for microphone access

### No Audio
- Check system audio settings
- Ensure microphone is not muted
- Verify browser has microphone permissions

### Connection Issues
- Ensure server is running on port 3001
- Ensure client is running on port 5173
- Check firewall settings
- For production, use HTTPS (required for WebRTC)

## Development Notes

- WebRTC requires HTTPS in production for getUserMedia
- Using Google's public STUN servers (sufficient for testing)
- For production, consider setting up TURN servers

## Contributing

This is a beta testing project. To report bugs or suggest features:

1. Open an issue on GitHub
2. Describe the bug or feature request
3. Include steps to reproduce (for bugs)

## License

MIT

## Credits

**ZLC ARTCC - Salt Lake City ARTCC**

Developed for VATSIM training and testing purposes.

Not affiliated with or endorsed by VATSIM.org.
