import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { VatsimUser } from '@fssphone/shared';

const router = Router();

const VATSIM_AUTH_URL = process.env.VATSIM_AUTH_URL || 'https://auth.vatsim.net';
const CLIENT_ID = process.env.VATSIM_CLIENT_ID || '';
const CLIENT_SECRET = process.env.VATSIM_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.VATSIM_REDIRECT_URI || 'http://localhost:3001/auth/vatsim/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Redirect to VATSIM OAuth
router.get('/vatsim', (_req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'full_name vatsim_details',
  });
  res.redirect(`${VATSIM_AUTH_URL}/oauth/authorize?${params}`);
});

// OAuth callback — exchange code for token, fetch user, issue JWT
router.get('/vatsim/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.redirect(`${CLIENT_URL}?error=missing_code`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(`${VATSIM_AUTH_URL}/oauth/token`, new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = tokenRes.data.access_token;

    // Fetch VATSIM user profile
    const userRes = await axios.get(`${VATSIM_AUTH_URL}/api/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = userRes.data.data;
    const user: VatsimUser = {
      cid: data.cid,
      name: data.personal.name_full,
      rating: data.vatsim.rating.id,
      ratingShort: data.vatsim.rating.short,
      ratingLong: data.vatsim.rating.long,
    };

    // Issue a short-lived JWT
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });

    // Redirect back to client with token
    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error('VATSIM OAuth error:', err);
    res.redirect(`${CLIENT_URL}?error=auth_failed`);
  }
});

// Return current user from JWT
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = jwt.verify(authHeader.slice(7), JWT_SECRET) as VatsimUser;
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
