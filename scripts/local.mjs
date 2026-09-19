import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Pages requires a standard Wrangler filename. Stage only source and a fake-resource
// config in a separate directory; never copy .dev.vars or production bindings.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.wrangler', 'local-preview');
const state = join(root, '.wrangler', 'rewrite');
await mkdir(stage, { recursive: true });
// Pages anchors its generated worker at the nearest package.json. Give staging
// its own package boundary so that it cannot rediscover the production config.
await writeFile(
  join(stage, 'package.json'),
  JSON.stringify({ name: 'cfpages-local-preview', private: true, type: 'module' }),
);
const folders = ['functions', 'server', 'src'];
if (process.argv[2] !== 'setup') folders.push('dist');
for (const folder of folders) {
  await cp(join(root, folder), join(stage, folder), { recursive: true });
}
const config = JSON.parse(await readFile(join(root, 'wrangler.local.jsonc'), 'utf8'));
config.pages_build_output_dir = './dist';
config.d1_databases[0].migrations_dir = join(root, 'migrations');
await writeFile(join(stage, 'wrangler.jsonc'), JSON.stringify(config, null, 2));
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
async function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: stage,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(Error(`Local Wrangler exited: ${code}`)),
    );
  });
}
await run(['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state]);
if (process.argv[2] !== 'setup') {
  await run([
    'pages',
    'dev',
    './dist',
    '--persist-to',
    state,
    '--port',
    '8788',
    '--ip',
    '127.0.0.1',
  ]);
}
