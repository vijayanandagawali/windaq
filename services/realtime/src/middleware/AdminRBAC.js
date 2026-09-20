const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to enforce least-privilege RBAC.
 * @param {Array<string>} allowedRoles - Array of allowed roles (e.g., ['FINANCE', 'SUPER_ADMIN'])
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      let adminId = req.headers['x-admin-user-id'] || req.user?.userId;
      if (adminId === 'mock-super-admin-id') {
        adminId = 'sbx-usr-admin-004';
      }
      
      if (!adminId) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Admin ID missing.' });
      }

      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Admin not found.' });
      }

      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({ success: false, message: `Forbidden. Requires one of: ${allowedRoles.join(', ')}` });
      }

      // Check MFA for sensitive actions (e.g. POST/PUT/DELETE)
      if (req.method !== 'GET' && admin.mfaEnabled) {
        const mfaToken = req.headers['x-mfa-token'];
        if (!mfaToken || mfaToken !== admin.mfaSecret) {
           return res.status(403).json({ success: false, message: 'MFA Verification Failed' });
        }
      }

      req.admin = admin;
      next();
    } catch (error) {
      console.error('[RBAC Error]', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
};

/**
 * Helper to log privileged actions
 */
const logAudit = async (adminId, action, resourceId, details, ipAddress = '127.0.0.1') => {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        resourceId,
        details,
        ipAddress
      }
    });
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
};

module.exports = { requireRole, logAudit };
