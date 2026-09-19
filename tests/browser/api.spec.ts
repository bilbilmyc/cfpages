import { test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Reuse the integration assertions against the same isolated local Pages server.
// These scripts intentionally hard-code localhost and cannot target production.
for (const script of ['test-api.mjs', 'test-posts.mjs', 'test-documents.mjs']) {
  test(script, async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [`scripts/${script}`], {
      timeout: 25000,
      windowsHide: true,
    });
    console.log(stdout.trim());
  });
}
