import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';

const browser = process.argv[2];
const output = process.argv[3] ?? '.output';
if (!['chrome', 'edge'].includes(browser)) {
  throw new Error('Usage: node scripts/package-without-deletion.mjs <chrome|edge> [output-directory]');
}
const root = process.cwd();
const outDir = path.resolve(root, output);
const relative = path.relative(root, outDir);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
  throw new Error('Output must be inside the project.');
}
const browserOutput = path.join(outDir, `${browser}-mv3`);

// Keep the browser's loaded directory stable. WXT's initial cleanup is
// skipped, and Vite overwrites generated files without clearing the directory.
fs.promises.rm = async (target) => {
  if (path.resolve(target) === browserOutput) return;
  try {
    await fs.promises.lstat(target);
  } catch (cause) {
    if (cause.code === 'ENOENT') return;
    throw cause;
  }
  throw new Error(`Packaging cannot delete an existing path: ${target}`);
};
fs.promises.rmdir = async () => {
  throw new Error('Directory deletion is disabled during packaging.');
};
syncBuiltinESMExports();

const { zip } = await import('wxt');
await zip({ browser, outDir, vite: () => ({ build: { emptyOutDir: false } }) });
