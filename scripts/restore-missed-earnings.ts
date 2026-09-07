import dotenv from 'dotenv';
dotenv.config();
import { executeDeviceEarningsRestoration } from '../src/services/deviceEarningsRestoration';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting missed device earnings restoration (dryRun: ${isDryRun})...`);

  try {
    const report = await executeDeviceEarningsRestoration({ dryRun: isDryRun });
    console.log('=== RESTORATION REPORT ===');
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Restoration failed:', err);
    process.exit(1);
  }
}

main();
