/**
 * Build-time verification script.
 * Validates that no relative /api/* requests or unsafe window.location.origin API fallbacks
 * remain in the codebase before or after building.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[VERIFY-API] Starting codebase API routing verification...');

// Read environment variable from .env.production or .env, falling back to process.env
let envBase = '';
const envProdPath = path.resolve(__dirname, '../.env.production');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envProdPath)) {
  const content = fs.readFileSync(envProdPath, 'utf8');
  const m = content.match(/^VITE_API_BASE_URL=(.+)$/m);
  if (m) envBase = m[1].trim();
}
if (!envBase && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/^VITE_API_BASE_URL=(.+)$/m);
  if (m) envBase = m[1].trim();
}
if (!envBase || envBase.includes('ais-dev-')) {
  envBase = 'https://power-bank-3ib3vyvgja-as.a.run.app';
}
if (process.env.NODE_ENV === 'production' && !envBase) {
  console.error('[VERIFY-API] ERROR: VITE_API_BASE_URL must not be empty in production build.');
  process.exit(1);
}

if (envBase.endsWith('/api')) {
  console.error('[VERIFY-API] ERROR: VITE_API_BASE_URL must NOT end with "/api". Found:', envBase);
  process.exit(1);
}

if (envBase.includes('gainpower-top-1.com')) {
  console.error('[VERIFY-API] ERROR: VITE_API_BASE_URL must NOT target Hostinger domain.');
  process.exit(1);
}

const forbiddenPatterns = [
  { regex: /fetch\(\s*['"`]\/api\//g, desc: "Raw relative fetch('/api/...')" },
  { regex: /axios(?:\.get|\.post|\.put|\.delete)?\(\s*['"`]\/api\//g, desc: "Relative axios('/api/...')" },
  { regex: /window\.location\.origin\s*\+\s*['"`]\/api\//g, desc: 'window.location.origin + /api/ fallback' },
  { regex: /`\$\{window\.location\.origin\}\/api\//g, desc: '${window.location.origin}/api/ template fallback' },
  { regex: /`\$\{location\.origin\}\/api\//g, desc: '${location.origin}/api/ template fallback' },
  { regex: /['"`]https:\/\/gainpower-top-1\.com\/api\//g, desc: 'Hardcoded Hostinger API endpoint (https://gainpower-top-1.com/api/...)' },
  { regex: /ais-dev-[a-z0-9-]+\.asia-southeast1\.run\.app/g, desc: 'Old development AI Studio URL (ais-dev-...)' },
];

let errorCount = 0;

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '_PROJECT_BACKUP_FROZEN_CURRENT'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      // Exclude verification script itself and backend server
      if (entry.name === 'verify-api-routes.js' || entry.name === 'server.ts') {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        // Skip comment lines
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          return;
        }

        forbiddenPatterns.forEach(({ regex, desc }) => {
          regex.lastIndex = 0;
          if (regex.test(line)) {
            console.error(`[VERIFY-API] ERROR: ${desc} found at ${fullPath}:${index + 1}`);
            console.error(`  Line: ${trimmed}`);
            errorCount++;
          }
        });
      });
    }
  }
}

scanDirectory(path.resolve(__dirname, '../src'));

if (errorCount > 0) {
  console.error(`\n[VERIFY-API] FAILED: Found ${errorCount} forbidden API routing patterns in src/!`);
  process.exit(1);
}

console.log('[VERIFY-API] SUCCESS: All frontend API routes are properly centralized and protected.');
process.exit(0);
