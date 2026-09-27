const { authenticateSessionToken, SessionError } = require('../services/sessionService');

/**
 * Authenticates a request from its Bearer session token.
 * The token must reference an active server-side session; the principal (including role) is
 * loaded from the database, never taken from token claims.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { identity } = await authenticateSessionToken(token);
      req.user = identity;
      req.headers['x-user-id'] = identity.userId;
      return next();
    } catch (error) {
      if (error instanceof SessionError) {
        return res.status(401).json({ success: false, code: error.code, message: error.message });
      }
      console.error('[Auth] Session lookup failed:', error.message);
      return res.status(503).json({ success: false, code: 'AUTH_UNAVAILABLE', message: 'Authentication is temporarily unavailable.' });
    }
  }

  // Fallback support for sandbox/admin identity headers ONLY in non-production with explicit sandbox flag
  const isSandboxDemo = process.env.NODE_ENV !== 'production' && (process.env.ENABLE_SANDBOX_DEMO === 'true' || process.env.NODE_ENV === 'test');
  if (isSandboxDemo) {
    let adminId = req.headers['x-admin-user-id'];
    let userId = req.headers['x-user-id'];

    if (adminId) {
      if (adminId === 'mock-super-admin-id' || adminId === 'SUPER_ADMIN_DEMO_001') adminId = 'TEST_ADMIN';
      req.user = { userId: adminId, role: 'SUPER_ADMIN' };
      req.headers['x-admin-user-id'] = adminId;
      return next();
    }

    if (userId) {
      if (userId === 'mock-user-id') userId = 'TEST_PLAYER_01';
      req.user = { userId, role: 'USER' };
      req.headers['x-user-id'] = userId;
      return next();
    }
  }

  return res.status(401).json({ 
    success: false, 
    code: 'AUTH_REQUIRED', 
    message: 'Missing or invalid Authorization header. Please log in.' 
  });
};

module.exports = { requireAuth };
