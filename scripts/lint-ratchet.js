/**
 * Lint ratchet for the web app.
 *
 * The codebase still has pre-existing lint errors, so CI cannot require zero yet. Instead it fails
 * whenever the error or warning count goes UP compared with lint-baseline.json, and reminds you to
 * lower the baseline when counts go down.
 *
 *   node scripts/lint-ratchet.js           # check
 *   node scripts/lint-ratchet.js --update  # record current counts as the new baseline
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WEB_DIR = path.resolve(__dirname, '../apps/web');
const BASELINE_FILE = path.resolve(__dirname, '../lint-baseline.json');

// eslint's package exports hide bin/, so resolve it from its package.json location.
const eslintPkg = require.resolve('eslint/package.json', { paths: [WEB_DIR] });
const eslintBin = path.join(path.dirname(eslintPkg), require(eslintPkg).bin.eslint);
const result = spawnSync(process.execPath, [eslintBin, '.', '-f', 'json'], {
  cwd: WEB_DIR,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('Could not parse ESLint output:\n', (result.stderr || result.stdout || '').slice(0, 2000));
  process.exit(2);
}

const current = report.reduce(
  (acc, file) => ({ errors: acc.errors + file.errorCount, warnings: acc.warnings + file.warningCount }),
  { errors: 0, warnings: 0 }
);

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`Lint baseline updated: ${current.errors} errors, ${current.warnings} warnings.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
console.log(`Lint: ${current.errors} errors (baseline ${baseline.errors}), ${current.warnings} warnings (baseline ${baseline.warnings}).`);

if (current.errors > baseline.errors || current.warnings > baseline.warnings) {
  const worse = report
    .filter((f) => f.errorCount > 0)
    .map((f) => `  ${path.relative(WEB_DIR, f.filePath)}: ${f.errorCount} error(s)`)
    .join('\n');
  console.error('Lint regressions detected. Fix new problems before merging.\nFiles with errors:\n' + worse);
  process.exit(1);
}

if (current.errors < baseline.errors || current.warnings < baseline.warnings) {
  console.log('Counts went down — run "node scripts/lint-ratchet.js --update" and commit lint-baseline.json.');
}
