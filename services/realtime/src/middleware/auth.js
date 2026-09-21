const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-fallback');
      req.user = payload;
      req.headers['x-user-id'] = payload.userId;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          code: 'SESSION_EXPIRED', 
          message: 'Session expired. Please log in again.' 
        });
      }
      return res.status(401).json({ 
        success: false, 
        code: 'INVALID_TOKEN', 
        message: 'Invalid authorization token.' 
      });
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
