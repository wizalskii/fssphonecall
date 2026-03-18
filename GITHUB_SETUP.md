# GitHub Repository Setup

## Create GitHub Repository

Since the GitHub CLI is not available, please follow these steps to create the repository:

### Option 1: Using GitHub Web Interface

1. Go to https://github.com/new
2. Fill in the repository details:
   - **Repository name**: `fssphone`
   - **Description**: `FSS Phone Simulator - VATSIM WebRTC voice call simulator for IFR clearance delivery (ZLC ARTCC)`
   - **Visibility**: Public (or Private if preferred)
   - **Do NOT initialize** with README, .gitignore, or license (we already have these)
3. Click "Create repository"
4. Follow the instructions to push existing repository:

```bash
git remote add origin https://github.com/YOUR_USERNAME/fssphone.git
git branch -M main
git push -u origin main
```

### Option 2: Using GitHub CLI (if available)

```bash
gh repo create fssphone --public --source=. --description "FSS Phone Simulator - VATSIM WebRTC voice call simulator for IFR clearance delivery (ZLC ARTCC)" --push
```

## After Repository Creation

### Add Logos

1. Download official logos:
   - VATSIM logo from https://www.vatsim.net/
   - ZLC ARTCC logo from official ZLC sources

2. Place them in `client/public/`:
   - `client/public/vatsim-logo.png`
   - `client/public/zlc-logo.png`

3. Commit and push:
   ```bash
   git add client/public/*.png
   git commit -m "Add VATSIM and ZLC logos"
   git push
   ```

### Set Up Repository Topics

Add these topics to your repository for discoverability:
- `vatsim`
- `webrtc`
- `voice-communication`
- `fss`
- `flight-simulation`
- `react`
- `typescript`
- `socket-io`

### Add Repository Description

Make sure the repository has a clear description indicating it's a BETA testing tool.

## Next Steps

1. Install dependencies: `npm install`
2. Set up environment files (copy from .env.example)
3. Start development: `npm run dev`
4. Test the application with two browser windows
5. Report any issues on GitHub
