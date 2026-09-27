/**
 * Database write guard for scripts and local development.
 *
 * WinDaq dev scripts, seeders and the realtime engines write to whatever DATABASE_URL points at.
 * To stop anyone from accidentally seeding, wiping or running game loops against a shared or
 * production database, writes are only allowed when:
 *   - the database host is local (localhost / 127.0.0.1 / ::1), or
 *   - WINDAQ_ALLOW_REMOTE_DB_WRITE is set to the exact remote hostname (a typed confirmation).
 * Destructive scripts are additionally refused whenever NODE_ENV=production.
 */
const path = require('path');
const fs = require('fs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function loadRootEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const rootEnv = path.resolve(__dirname, '../../../../.env');
  if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv, quiet: true });
}

function describeDatabase(url) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, name: parsed.pathname.replace(/^\//, '') || '(default)' };
  } catch {
    return { host: null, name: null };
  }
}

/**
 * Returns { host, name, isLocal } or throws with instructions if writing is not allowed.
 */
function assertDatabaseWritable(context, { destructive = false } = {}) {
  loadRootEnvIfNeeded();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`[DB Guard] ${context}: DATABASE_URL is not set. Start a local database with "npm run db:local" and use the URL it prints.`);
  }

  const { host, name } = describeDatabase(url);
  if (!host) throw new Error(`[DB Guard] ${context}: DATABASE_URL is not a valid URL.`);

  if (destructive && process.env.NODE_ENV === 'production') {
    throw new Error(`[DB Guard] ${context}: destructive operation refused because NODE_ENV=production.`);
  }

  // Destructive scripts wipe data even on local databases, so they always need a typed
  // confirmation naming the exact database that will be erased.
  if (destructive && process.env.WINDAQ_CONFIRM_DESTRUCTIVE !== name) {
    throw new Error(
      `[DB Guard] ${context}: this script DELETES data in database "${name}" on ${host}.\n` +
      `  Nothing was changed. To proceed, re-run with WINDAQ_CONFIRM_DESTRUCTIVE=${name}`
    );
  }

  const isLocal = LOCAL_HOSTS.has(host);
  if (!isLocal && process.env.WINDAQ_ALLOW_REMOTE_DB_WRITE !== host) {
    throw new Error(
      `[DB Guard] ${context}: refusing to write to remote database host "${host}" (db "${name}").\n` +
      `  Use a local database: run "npm run db:local" and set DATABASE_URL to the printed dev URL.\n` +
      `  If you really intend to write to this remote database, set WINDAQ_ALLOW_REMOTE_DB_WRITE=${host}`
    );
  }

  return { host, name, isLocal };
}

/**
 * CLI helper: same checks, but prints the reason and exits instead of throwing.
 */
function guardDatabaseOrExit(context, options) {
  try {
    const info = assertDatabaseWritable(context, options);
    console.log(`[DB Guard] ${context}: writing to ${info.isLocal ? 'local' : 'REMOTE'} database "${info.name}" on ${info.host}`);
    return info;
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { assertDatabaseWritable, guardDatabaseOrExit, describeDatabase };
