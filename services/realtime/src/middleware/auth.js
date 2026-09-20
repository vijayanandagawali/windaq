const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For demo/prototype purposes, if they send 'x-user-id' we might let it pass 
    // ONLY IF we explicitly allow fallback. But for security hardening, we reject.
    return res.status(401).json({ success: false, message: 'Missing Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-fallback');
    req.user = payload; // Attach user to request
    
    // Override x-user-id for legacy internal handlers that haven't been fully migrated
    req.headers['x-user-id'] = payload.userId;
    
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { requireAuth };
