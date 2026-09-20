const fs = require('fs');
const path = require('path');

const sensitiveKeys = ['token', 'password', 'cvv', 'otp', 'secret', 'authorization'];

/**
 * Recursively sanitizes objects by masking sensitive keys
 */
function sanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;

/**
 * Scrubber intercepts console logs and masks sensitive info before writing to stdout
 */
function maskArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'object') {
      return sanitize(arg);
    }
    if (typeof arg === 'string') {
      // Basic regex replacement for common patterns if needed, but object sanitization covers most API loggers
      let s = arg;
      if (s.includes('Bearer ')) {
        s = s.replace(/Bearer\s[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer ***REDACTED***');
      }
      return s;
    }
    return arg;
  });
}

const logger = {
  log: (...args) => originalConsoleLog(...maskArgs(args)),
  error: (...args) => originalConsoleError(...maskArgs(args)),
  info: (...args) => originalConsoleInfo(...maskArgs(args)),
};

// Override global console methods for the entire backend application
console.log = logger.log;
console.error = logger.error;
console.info = logger.info;

module.exports = logger;
