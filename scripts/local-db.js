/**
 * Local PostgreSQL for development and tests (no Docker required).
 *
 *   npm run db:local
 *
 * Starts PostgreSQL 15 on 127.0.0.1:55432 with data in .local/pgdata (git-ignored), creates
 * `windaq_dev` and `windaq_test` (UTF-8), pushes the Prisma schema to both, and keeps running
 * until Ctrl+C. Credentials are local-only defaults and never leave this machine.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PORT = Number(process.env.WINDAQ_LOCAL_DB_PORT || 55432);
const USER = 'windaq';
const PASSWORD = 'windaq_local';
const DATA_DIR = path.resolve(__dirname, '../.local/pgdata');
const SCHEMA = path.resolve(__dirname, '../services/wallet/prisma/schema.prisma');
const DATABASES = ['windaq_dev', 'windaq_test'];

const urlFor = (db) => `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${db}`;

async function main() {
  let EmbeddedPostgres;
  try {
    EmbeddedPostgres = (await import('embedded-postgres')).default;
  } catch {
    console.error('embedded-postgres is not installed. Run "npm install" at the repo root first.');
    process.exit(1);
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {}
  });

  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log(`Initialising local PostgreSQL in ${DATA_DIR} ...`);
    await pg.initialise();
  }
  await pg.start();

  for (const db of DATABASES) {
    try { await pg.createDatabase(db); } catch { /* already exists */ }
    execSync(`npx prisma db push --schema "${SCHEMA}" --skip-generate`, {
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: urlFor(db) }
    });
  }

  console.log('\nLocal PostgreSQL is running (Ctrl+C to stop).');
  console.log(`  Dev:  DATABASE_URL=${urlFor('windaq_dev')}`);
  console.log(`  Test: DATABASE_URL_TEST=${urlFor('windaq_test')}\n`);

  const stop = async () => {
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error('Failed to start local PostgreSQL:', err.message);
  process.exit(1);
});
