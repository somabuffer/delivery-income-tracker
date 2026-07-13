const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL || '').toLowerCase();

const client = new OAuth2Client(CLIENT_ID);

async function verifyGoogleCredential(credential) {
  if (!CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.email_verified) {
    throw new Error('Email not verified by Google');
  }
  const email = payload.email.toLowerCase();
  if (!ALLOWED_EMAIL || email !== ALLOWED_EMAIL) {
    throw new Error('This Google account is not authorized to use this app');
  }
  return { email, name: payload.name || '', picture: payload.picture || '' };
}

function requireAuth(req, res, next) {
  if (req.session && req.session.email && req.session.email === ALLOWED_EMAIL) {
    return next();
  }
  return res.status(401).json({ error: 'Not authenticated' });
}

module.exports = { verifyGoogleCredential, requireAuth, CLIENT_ID, ALLOWED_EMAIL };
