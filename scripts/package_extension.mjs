import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('../', import.meta.url).pathname);
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const archive = resolve(root, `project-oasis-v${version}.zip`);

rmSync(archive, { force: true });
const result = spawnSync('zip', [
  '-X', '-r', archive, '.',
  '-x', '*.map', '.DS_Store', 'Thumbs.db',
], {
  cwd: resolve(root, 'dist'),
  stdio: 'inherit',
});

if (result.status !== 0) {
  throw new Error(`zip failed with exit code ${result.status}`);
}

console.log(`Created ${archive}`);
