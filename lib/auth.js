const { createClerkClient, verifyToken } = require('@clerk/backend');

const PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL || '').toLowerCase();

const clerkClient = SECRET_KEY ? createClerkClient({ secretKey: SECRET_KEY }) : null;

// Looking up the user's email from Clerk on every request would mean an extra
// network round-trip per API call, so cache it briefly per userId.
const emailCache = new Map(); // userId -> { email, expires }
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getUserEmail(userId) {
  const cached = emailCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.email;
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
  const email = ((primary || user.emailAddresses[0])?.emailAddress || '').toLowerCase();
  emailCache.set(userId, { email, expires: Date.now() + CACHE_TTL_MS });
  return email;
}

async function requireAuth(req, res, next) {
  try {
    if (!SECRET_KEY) throw new Error('CLERK_SECRET_KEY is not configured on the server');
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const result = await verifyToken(token, { secretKey: SECRET_KEY });
    if (result.errors) return res.status(401).json({ error: 'Not authenticated' });

    const email = await getUserEmail(result.data.sub);
    if (!ALLOWED_EMAIL || email !== ALLOWED_EMAIL) {
      return res.status(403).json({ error: 'This account is not authorized to use this app' });
    }
    req.userEmail = email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireAuth, PUBLISHABLE_KEY };
