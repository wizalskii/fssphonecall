# Railway Deployment Guide

## Prerequisites

- GitHub repository: https://github.com/wizalskii/fssphonecall
- Railway account: https://railway.app/

## Deployment Steps

### 1. Create New Project in Railway

1. Go to https://railway.app/
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `wizalskii/fssphonecall`
5. Railway will automatically detect the configuration

### 2. Configure Environment Variables

In your Railway project settings, add these environment variables:

**Required Variables:**
```
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-frontend-domain.com
```

**Note:** Railway automatically provides a `PORT` variable, so you can omit it if you want Railway to assign the port automatically.

### 3. Build Configuration

The repository includes:
- `railway.json` - Railway-specific configuration
- `nixpacks.toml` - Nixpacks build configuration

These files ensure:
- Shared types are built first
- Server is built with proper dependencies
- Workspace monorepo structure is handled correctly

### 4. Deployment Process

Railway will:
1. Install all dependencies (`npm install`)
2. Build shared package (via `postinstall` hook)
3. Build server package
4. Start the server with `npm start`

### 5. Get Your Server URL

After deployment:
1. Go to your Railway project
2. Click on "Settings" → "Networking"
3. Copy the generated domain (e.g., `fssphone-production.up.railway.app`)

### 6. Update Client Configuration

Once you have your server URL, update your client to point to it:

```env
# client/.env
VITE_SERVER_URL=https://your-railway-domain.up.railway.app
```

## Deploying the Client

The client (frontend) should be deployed separately to a service like:
- **Vercel** (Recommended for React apps)
- **Netlify**
- **Cloudflare Pages**

### Deploy Client to Vercel:

1. Go to https://vercel.com/
2. Import your GitHub repository
3. Configure build settings:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variable:
   - `VITE_SERVER_URL` = Your Railway server URL

## Domain Configuration

### For Server (Railway):
1. In Railway, go to Settings → Networking
2. Add your custom domain
3. Configure DNS records as instructed by Railway

### For Client (Vercel/Netlify):
1. Add custom domain in your hosting provider
2. Update DNS records to point to provider

### Cloudflare Setup (Optional):
If you want DDoS protection via Cloudflare:

1. Add your domain to Cloudflare
2. Point A/CNAME records to your hosting providers
3. Enable "Proxy" (orange cloud) in Cloudflare DNS
4. Configure SSL/TLS to "Full" or "Full (strict)"

## Environment Variables Reference

### Server (Railway)
```
NODE_ENV=production
PORT=3001                    # Optional, Railway provides this
CLIENT_URL=https://your-client-domain.com
```

### Client (Vercel/Netlify)
```
VITE_SERVER_URL=https://your-server-railway-domain.up.railway.app
```

## Troubleshooting

### Build Fails with "Cannot find module '@fssphone/shared'"

This should be fixed with the current configuration. If it persists:
1. Check that `postinstall` script runs in build logs
2. Verify `shared` package builds successfully
3. Check Railway build logs for errors

### WebRTC Not Working

WebRTC requires HTTPS in production:
1. Ensure both client and server use HTTPS
2. Railway provides HTTPS by default
3. Vercel/Netlify provide HTTPS by default

### CORS Errors

Update `CLIENT_URL` environment variable on Railway to match your actual client domain.

## Monitoring

Railway provides:
- Build logs
- Deployment logs
- Metrics dashboard
- Automatic deployments on git push

## Cost Considerations

- Railway: Free tier includes $5 credit/month
- Vercel: Free tier for hobby projects
- Domain: ~$10-15/year on Namecheap
- Cloudflare: Free tier available

## Support

For issues specific to:
- **Application bugs:** Open issue on GitHub
- **Railway deployment:** Check Railway docs or Discord
- **WebRTC issues:** Ensure HTTPS and proper STUN/TURN configuration
