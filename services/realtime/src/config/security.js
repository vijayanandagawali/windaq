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
}

module.exports = { getJwtSecret, assertSecurityConfig, requireSecret };
