const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');

const PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL || '').toLowerCase();

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

// Our own gate on top of clerkMiddleware(): being signed in to Clerk is not enough,
// the account's email must also match ALLOWED_EMAIL (this stays single-user even
// though Clerk itself may allow anyone to sign up).
async function requireAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const email = await getUserEmail(userId);
    if (!ALLOWED_EMAIL || email !== ALLOWED_EMAIL) {
      return res.status(403).json({ error: 'This account is not authorized to use this app' });
    }
    req.userEmail = email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

module.exports = { clerkMiddleware, requireAuth, PUBLISHABLE_KEY, SECRET_KEY };
