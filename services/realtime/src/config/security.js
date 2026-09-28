/**
 * Centralised security configuration.
 * Secrets are REQUIRED — there are no hard-coded fallbacks. A missing secret stops the
 * service at startup instead of silently signing tokens with a publicly known key.
 */

const MIN_SECRET_LENGTH = 32;

function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`[Security] ${name} must be set to a random value of at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

function getJwtSecret() {
  return requireSecret('JWT_SECRET');
}

/**
 * Validates all mandatory secrets. Called once on startup so misconfiguration fails fast.
 */
function assertSecurityConfig() {
  getJwtSecret();
  getAllowedOrigins();
}

/**
 * Browser origins allowed to call the API and open sockets. FRONTEND_URL may list several,
 * comma-separated (e.g. "https://daqwon.in,https://www.daqwon.in"). Unset means any origin,
 * which is only acceptable outside production.
 */
function getAllowedOrigins() {
  const list = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  if (list.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security] FRONTEND_URL must list the allowed site origin(s) in production.');
    }
    return '*';
  }
  return list;
}

module.exports = { getJwtSecret, assertSecurityConfig, requireSecret, getAllowedOrigins };
