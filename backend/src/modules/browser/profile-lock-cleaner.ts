import * as fs from 'fs';
import * as path from 'path';

const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

export function cleanProfileLocks(folderPath: string): void {
  for (const name of LOCK_FILES) {
    const p = path.join(folderPath, name);
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // ignore — file may not exist or be a symlink Chromium creates
    }
  }
}
