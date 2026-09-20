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

  // Fallback support for sandbox/admin identity headers
  let adminId = req.headers['x-admin-user-id'];
  let userId = req.headers['x-user-id'];

  if (adminId) {
    if (adminId === 'mock-super-admin-id') adminId = 'sbx-usr-admin-004';
    req.user = { userId: adminId, role: 'SUPER_ADMIN' };
    req.headers['x-admin-user-id'] = adminId;
    return next();
  }

  if (userId) {
    if (userId === 'mock-user-id') userId = 'sbx-usr-normal-001';
    req.user = { userId, role: 'USER' };
    req.headers['x-user-id'] = userId;
    return next();
  }

  return res.status(401).json({ success: false, message: 'Missing Authorization header' });
};

module.exports = { requireAuth };
