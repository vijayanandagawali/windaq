const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to enforce least-privilege RBAC.
 * @param {Array<string>} allowedRoles - Array of allowed roles (e.g., ['FINANCE', 'SUPER_ADMIN'])
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Prioritize verified JWT session
      let adminId = req.user?.userId;

      // Sandbox header fallback ONLY if explicit sandbox flag is on and not in production
      const isSandboxDemo = process.env.NODE_ENV !== 'production' && (process.env.ENABLE_SANDBOX_DEMO === 'true' || process.env.NODE_ENV === 'test');
      if (!adminId && isSandboxDemo) {
        const headerAdminId = req.headers['x-admin-user-id'];
        if (headerAdminId) {
          adminId = (headerAdminId === 'mock-super-admin-id' || headerAdminId === 'SUPER_ADMIN_DEMO_001')
            ? 'TEST_ADMIN'
            : headerAdminId;
        }
      }
      
      if (!adminId) {
        return res.status(401).json({ 
          success: false, 
          code: 'AUTH_REQUIRED', 
          message: 'Unauthorized. Privileged administrator session required.' 
        });
      }

      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      if (!admin) {
        return res.status(401).json({ 
          success: false, 
          code: 'ADMIN_NOT_FOUND', 
          message: 'Unauthorized. Administrator account not found.' 
        });
      }

      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({ 
          success: false, 
          code: 'FORBIDDEN', 
          message: `Forbidden. Requires one of privileged roles: ${allowedRoles.join(', ')}` 
        });
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
