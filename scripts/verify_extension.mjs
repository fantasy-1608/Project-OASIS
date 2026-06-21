import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('dist/manifest.json', root), 'utf8'));

assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
assert.equal(manifest.version, packageJson.version, 'package and manifest versions must match');
assert.ok(manifest.description.length <= 132, 'manifest description exceeds 132 characters');
assert.ok(manifest.action, 'manifest.action is required when chrome.action is used');
assert.equal(manifest.side_panel?.default_path, 'index.html', 'side panel entry is missing');
assert.deepEqual(manifest.permissions, ['sidePanel', 'storage'], 'review manifest permissions');
assert.deepEqual(manifest.host_permissions, ['https://*.supabase.co/*'], 'review host permissions');
assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'), 'unsafe-eval is not allowed');

const requiredFiles = [
  'dist/index.html',
  'dist/sw.js',
  'dist/content.js',
  'dist/injected.js',
  'dist/privacy.html',
  'PRIVACY.md',
  'CHROMEWEBSTORE.md',
  'store-assets/screenshot-1-board.png',
  'store-assets/screenshot-2-privacy.png',
  'store-assets/small-promo-tile.png',
];
for (const relativePath of requiredFiles) {
  assert.ok(existsSync(new URL(relativePath, root)), `missing required file: ${relativePath}`);
}

const expectedIcons = { '16': [16, 16], '48': [48, 48], '128': [128, 128] };
for (const [size, dimensions] of Object.entries(expectedIcons)) {
  const iconPath = `dist/${manifest.icons[size]}`;
  const icon = readFileSync(new URL(iconPath, root));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${iconPath} is not a PNG`);
  assert.equal(icon.readUInt32BE(16), dimensions[0], `${iconPath} has wrong width`);
  assert.equal(icon.readUInt32BE(20), dimensions[1], `${iconPath} has wrong height`);
}

const indexHtml = readFileSync(new URL('dist/index.html', root), 'utf8');
assert.ok(!/<script[^>]+src=["']https?:/i.test(indexHtml), 'remote scripts are prohibited');
assert.ok(!/\son[a-z]+\s*=/i.test(indexHtml), 'inline event handlers are prohibited');

const cssFiles = readdirSync(new URL('dist/assets/', root)).filter(file => extname(file) === '.css');
for (const file of cssFiles) {
  const css = readFileSync(new URL(`dist/assets/${file}`, root), 'utf8');
  assert.ok(!/@import\s+url\(["']?https?:/i.test(css), `${file} imports a remote stylesheet`);
}

for (const file of ['dist/content.js', 'dist/injected.js', 'dist/sw.js']) {
  const source = readFileSync(new URL(file, root), 'utf8');
  assert.ok(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `${file} uses dynamic code execution`);
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const distPath = fileURLToPath(new URL('dist/', root));
assert.equal(walk(distPath).filter(file => file.endsWith('.map')).length, 0, 'source maps must not ship');

console.log(`Chrome extension verification passed for v${packageJson.version}`);
