import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, '..', '..');
const repoRoot = path.resolve(serverRoot, '..');

export function resolveFromRepo(relativeOrAbsolutePath: string) {
  return path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.resolve(repoRoot, relativeOrAbsolutePath);
}

export function ensureDirectoryExists(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export { repoRoot, serverRoot };
